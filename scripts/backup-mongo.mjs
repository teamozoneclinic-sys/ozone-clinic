#!/usr/bin/env node
/**
 * MongoDB → local disk backup, zero-loss.
 *
 * Reads MONGODB_URI from .env.local, enumerates every collection in the
 * connected database, and writes one Extended-JSON file per collection to
 * `data-backup/<timestamp>/`. Also writes a manifest.json for verification.
 *
 * Why Extended JSON (canonical mode):
 *   - Preserves ObjectId, Date, Binary, Decimal128, Long — everything BSON
 *     supports — using tagged JSON like {"$oid": "…"}, {"$date": {"$numberLong": …}}
 *   - Round-trips exactly through restore-mongo.mjs (no data loss)
 *
 * Binary files (PatientFile.data — uploaded PDFs/images) are stored under
 * {"$binary": {"base64": "…", "subType": "00"}} — byte-perfect preservation.
 *
 * Read-only on the source database. Safe to run while the app is live.
 *
 * Usage:  node scripts/backup-mongo.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MongoClient } from "mongodb"
import { EJSON } from "bson"

// ─── Paths ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..")

// ─── Load MONGODB_URI from .env.local (no dep needed) ─────────────────────
function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, ".env.local")
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found at " + envPath)
  }
  const content = fs.readFileSync(envPath, "utf8")
  const env = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = loadEnvLocal()
const rawUri = env.MONGODB_URI
if (!rawUri) throw new Error("MONGODB_URI missing from .env.local")

// ─── SRV → direct URI via DNS-over-HTTPS ─────────────────────────────────
// Atlas `mongodb+srv://` URIs require DNS SRV + TXT lookups. Some corporate
// / local resolvers time out on TXT queries. To make this script resilient,
// we resolve those records via Cloudflare DoH (plain HTTPS) and rewrite the
// URI to the direct `mongodb://` form. This works regardless of the local
// DNS setup and doesn't change the source data one bit.
async function doh(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
  const res = await fetch(url, { headers: { accept: "application/dns-json" } })
  if (!res.ok) throw new Error(`DoH lookup failed (${res.status}) for ${type} ${name}`)
  const body = await res.json()
  return body.Answer ?? []
}

async function srvUriToDirect(srvUri) {
  const m = srvUri.match(/^mongodb\+srv:\/\/([^@]+@)?([^/?]+)(\/[^?]*)?(\?.*)?$/)
  if (!m) return srvUri // not an SRV URI, leave as-is
  const [, userInfo = "", host, dbPart = "/", queryPart = ""] = m

  const [srvAns, txtAns] = await Promise.all([
    doh(`_mongodb._tcp.${host}`, "SRV"),
    doh(host, "TXT"),
  ])
  if (srvAns.length === 0) throw new Error(`No SRV records for ${host}`)

  // SRV data looks like: "0 0 27017 shard-host.mongodb.net."
  const hostPorts = srvAns
    .map((a) => {
      const parts = String(a.data).split(/\s+/)
      const port = parts[2] || "27017"
      const h = (parts[3] || "").replace(/\.$/, "")
      return h ? `${h}:${port}` : null
    })
    .filter(Boolean)
    .join(",")

  // TXT data comes back quoted: '"authSource=admin&replicaSet=..."'
  const txtOptions = txtAns
    .map((a) => String(a.data).replace(/^"|"$/g, ""))
    .join("&")

  const existingQuery = queryPart.replace(/^\?/, "")
  const mergedQuery = [txtOptions, existingQuery, "ssl=true"]
    .filter(Boolean)
    .join("&")

  return `mongodb://${userInfo}${hostPorts}${dbPart}?${mergedQuery}`
}

console.log("Resolving Atlas cluster (via DNS-over-HTTPS)…")
const uri = rawUri.startsWith("mongodb+srv://") ? await srvUriToDirect(rawUri) : rawUri

// Mask credentials for safe console output
const maskedUri = uri.replace(/\/\/([^:@/]+):([^@]+)@/, "//$1:****@")

// ─── Output folder (timestamped so re-runs never overwrite) ──────────────
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) // 2026-07-13T22-30-00
const outDir = path.join(PROJECT_ROOT, "data-backup", ts)
fs.mkdirSync(outDir, { recursive: true })

// Extract the database name from the URI (…/dbName?options)
function extractDbName(u) {
  const m = u.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}
const dbNameFromUri = extractDbName(uri)

console.log("─".repeat(60))
console.log("MongoDB → local backup")
console.log("─".repeat(60))
console.log(`Source:  ${maskedUri}`)
console.log(`Target:  ${outDir}`)
console.log()

// ─── Connect and dump ────────────────────────────────────────────────────
const client = new MongoClient(uri, {
  // Fresh, no pooling weirdness for a one-shot script
  maxPoolSize: 5,
})

try {
  await client.connect()
  const db = dbNameFromUri ? client.db(dbNameFromUri) : client.db()
  const dbName = db.databaseName

  console.log(`Database: ${dbName}`)

  const collections = await db.listCollections().toArray()
  const userCollections = collections.filter((c) => !c.name.startsWith("system."))
  console.log(`Collections: ${userCollections.length}`)
  console.log()

  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceDatabase: dbName,
    format: "extended-json-canonical",
    formatNote: "Parse with bson EJSON.parse({...}, {relaxed: false}) to restore all BSON types.",
    tool: "scripts/backup-mongo.mjs",
    node: process.version,
    collections: [],
  }

  for (const info of userCollections) {
    const name = info.name
    const coll = db.collection(name)

    // Cursor-based read (no full-array in RAM on the driver side)
    const docs = []
    for await (const doc of coll.find({}, { batchSize: 500 })) {
      docs.push(doc)
    }

    // Canonical EJSON — preserves ObjectId, Date, Binary, everything
    const ejson = EJSON.stringify(docs, undefined, 2, { relaxed: false })
    const outPath = path.join(outDir, `${name}.json`)
    fs.writeFileSync(outPath, ejson)

    const bytes = fs.statSync(outPath).size
    const sizeKB = (bytes / 1024).toFixed(1)
    console.log(
      `  ✓ ${name.padEnd(24)} ${String(docs.length).padStart(6)} docs` +
      `  →  ${sizeKB.padStart(9)} KB`
    )

    manifest.collections.push({
      name,
      documentCount: docs.length,
      sizeBytes: bytes,
      file: `${name}.json`,
    })
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  )

  const totalDocs = manifest.collections.reduce((s, c) => s + c.documentCount, 0)
  const totalBytes = manifest.collections.reduce((s, c) => s + c.sizeBytes, 0)
  console.log()
  console.log("─".repeat(60))
  console.log(
    `Total: ${totalDocs} documents  •  ${(totalBytes / 1024 / 1024).toFixed(2)} MB` +
    `  •  ${userCollections.length} collections`
  )
  console.log(`Manifest: ${path.join(outDir, "manifest.json")}`)
  console.log("─".repeat(60))
  console.log(
    "Backup complete. When your new MongoDB is ready, run:\n" +
    `  node scripts/restore-mongo.mjs "${path.relative(PROJECT_ROOT, outDir)}" --uri "<new-mongo-uri>"`
  )
} finally {
  await client.close()
}
