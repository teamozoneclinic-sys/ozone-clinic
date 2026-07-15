#!/usr/bin/env node
/**
 * Restore a backup produced by backup-mongo.mjs into a fresh MongoDB.
 *
 * Usage:
 *   node scripts/restore-mongo.mjs <backup-folder> --uri "<new-mongodb-uri>"
 *   node scripts/restore-mongo.mjs <backup-folder> --uri "<uri>" --db <dbName>
 *   node scripts/restore-mongo.mjs <backup-folder> --uri "<uri>" --force
 *
 * Safety rules (all on by default):
 *   1. Refuses to restore into a database that already contains any of the
 *      backed-up collections — pass --force to overwrite (destructive!).
 *   2. Parses using EJSON canonical mode → all ObjectIds, Dates, and Binary
 *      files are restored byte-perfect.
 *   3. Reports counts per collection at the end for verification against
 *      the manifest.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MongoClient } from "mongodb"
import { EJSON } from "bson"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..")

// ─── Parse CLI args ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { positional: [], uri: null, db: null, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--uri") out.uri = argv[++i]
    else if (a === "--db") out.db = argv[++i]
    else if (a === "--force") out.force = true
    else if (a === "--help" || a === "-h") {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8")
        .split("\n").slice(1, 18).map((l) => l.replace(/^ \*\s?/, "")).join("\n"))
      process.exit(0)
    }
    else out.positional.push(a)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
if (args.positional.length !== 1 || !args.uri) {
  console.error(
    "Usage: node scripts/restore-mongo.mjs <backup-folder> --uri \"<new-mongo-uri>\" [--db <name>] [--force]"
  )
  process.exit(1)
}

// ─── SRV → direct URI via DNS-over-HTTPS ─────────────────────────────────
// Mirrors the fallback used by backup-mongo.mjs — some local DNS resolvers
// time out on the TXT queries Atlas SRV URIs require. Cloudflare DoH is
// used to resolve SRV + TXT records reliably over plain HTTPS.
async function doh(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
  const res = await fetch(url, { headers: { accept: "application/dns-json" } })
  if (!res.ok) throw new Error(`DoH lookup failed (${res.status}) for ${type} ${name}`)
  const body = await res.json()
  return body.Answer ?? []
}

async function srvUriToDirect(srvUri) {
  const m = srvUri.match(/^mongodb\+srv:\/\/([^@]+@)?([^/?]+)(\/[^?]*)?(\?.*)?$/)
  if (!m) return srvUri
  const [, userInfo = "", host, dbPart = "/", queryPart = ""] = m

  const [srvAns, txtAns] = await Promise.all([
    doh(`_mongodb._tcp.${host}`, "SRV"),
    doh(host, "TXT"),
  ])
  if (srvAns.length === 0) throw new Error(`No SRV records for ${host}`)

  const hostPorts = srvAns
    .map((a) => {
      const parts = String(a.data).split(/\s+/)
      const port = parts[2] || "27017"
      const h = (parts[3] || "").replace(/\.$/, "")
      return h ? `${h}:${port}` : null
    })
    .filter(Boolean)
    .join(",")

  const txtOptions = txtAns
    .map((a) => String(a.data).replace(/^"|"$/g, ""))
    .join("&")

  const existingQuery = queryPart.replace(/^\?/, "")
  const mergedQuery = [txtOptions, existingQuery, "ssl=true"]
    .filter(Boolean)
    .join("&")

  return `mongodb://${userInfo}${hostPorts}${dbPart}?${mergedQuery}`
}

if (args.uri.startsWith("mongodb+srv://")) {
  console.log("Resolving Atlas cluster (via DNS-over-HTTPS)…")
  args.uri = await srvUriToDirect(args.uri)
}

// ─── Resolve backup folder ───────────────────────────────────────────────
const backupDir = path.isAbsolute(args.positional[0])
  ? args.positional[0]
  : path.resolve(PROJECT_ROOT, args.positional[0])

if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
  console.error(`Backup folder not found: ${backupDir}`)
  process.exit(1)
}

const manifestPath = path.join(backupDir, "manifest.json")
if (!fs.existsSync(manifestPath)) {
  console.error(`manifest.json missing in ${backupDir} — not a valid backup folder.`)
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

// ─── Mask URI for output ─────────────────────────────────────────────────
const maskedUri = args.uri.replace(/\/\/([^:@/]+):([^@]+)@/, "//$1:****@")

function extractDbName(u) {
  const m = u.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}
const targetDbFromArg = args.db
const targetDbFromUri = extractDbName(args.uri)

console.log("─".repeat(60))
console.log("Restore MongoDB backup")
console.log("─".repeat(60))
console.log(`Source folder: ${backupDir}`)
console.log(`Manifest:      ${manifest.collections.length} collections, ` +
  `${manifest.collections.reduce((s, c) => s + c.documentCount, 0)} documents ` +
  `(exported ${manifest.exportedAt})`)
console.log(`Original DB:   ${manifest.sourceDatabase}`)
console.log(`Target URI:    ${maskedUri}`)
console.log(`Target DB:     ${targetDbFromArg || targetDbFromUri || "(from URI or driver default)"}`)
console.log(`Force mode:    ${args.force ? "YES — will overwrite existing collections" : "no"}`)
console.log()

// ─── Connect and restore ─────────────────────────────────────────────────
const client = new MongoClient(args.uri, { maxPoolSize: 5 })

try {
  await client.connect()
  const db = targetDbFromArg
    ? client.db(targetDbFromArg)
    : targetDbFromUri
      ? client.db(targetDbFromUri)
      : client.db()
  console.log(`Connected to database: ${db.databaseName}`)
  console.log()

  // ─── Safety check: refuse to overwrite existing data ────────────────
  if (!args.force) {
    const existing = new Set(
      (await db.listCollections().toArray()).map((c) => c.name)
    )
    const conflicts = manifest.collections
      .filter((c) => existing.has(c.name))
      .map((c) => c.name)
    if (conflicts.length > 0) {
      console.error(
        `ABORTED — the target database already contains these collections:\n` +
        conflicts.map((n) => `  • ${n}`).join("\n") +
        `\n\nRe-run with --force to overwrite (this DROPS the existing collections first).`
      )
      process.exit(2)
    }
  }

  const restored = []

  for (const entry of manifest.collections) {
    const filePath = path.join(backupDir, entry.file)
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Skipping ${entry.name} — file missing: ${entry.file}`)
      continue
    }

    // Parse canonical EJSON → restores ObjectId, Date, Binary, Decimal128 …
    const raw = fs.readFileSync(filePath, "utf8")
    const docs = EJSON.parse(raw, { relaxed: false })
    if (!Array.isArray(docs)) {
      console.warn(`  ⚠ Skipping ${entry.name} — file is not a JSON array.`)
      continue
    }

    const coll = db.collection(entry.name)
    if (args.force) {
      await coll.deleteMany({}).catch(() => {})
    }

    if (docs.length === 0) {
      restored.push({ name: entry.name, inserted: 0 })
      console.log(`  ○ ${entry.name.padEnd(24)} 0 docs (empty)`)
      continue
    }

    // Insert in chunks to avoid the 16MB per-request BSON limit
    const CHUNK = 500
    let inserted = 0
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = docs.slice(i, i + CHUNK)
      const res = await coll.insertMany(batch, { ordered: false })
      inserted += res.insertedCount
    }

    restored.push({ name: entry.name, inserted, expected: entry.documentCount })
    const flag = inserted === entry.documentCount ? "✓" : "⚠"
    console.log(
      `  ${flag} ${entry.name.padEnd(24)} ${String(inserted).padStart(6)} docs` +
      (inserted !== entry.documentCount ? ` (expected ${entry.documentCount})` : "")
    )
  }

  const totalInserted = restored.reduce((s, r) => s + r.inserted, 0)
  const totalExpected = manifest.collections.reduce((s, c) => s + c.documentCount, 0)

  console.log()
  console.log("─".repeat(60))
  console.log(
    `Inserted: ${totalInserted} / ${totalExpected} documents ` +
    `across ${restored.length} collections`
  )
  if (totalInserted !== totalExpected) {
    console.log("⚠ Some documents were not restored — check warnings above.")
    process.exit(3)
  }
  console.log("Restore complete.")
  console.log("─".repeat(60))
} finally {
  await client.close()
}
