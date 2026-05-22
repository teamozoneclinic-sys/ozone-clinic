/**
 * Clear transactional data for clean testing.
 *
 *   KEEPS  : doctors, procedures (testcatalogs), users, clinic settings
 *   CLEARS : patients, appointments, treatments, invoices, audit logs,
 *            patient files, WhatsApp sessions, temp files, appointment requests
 *
 *   node scripts/clear-test-data.mjs
 */
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import mongoose from "mongoose"

// ── Load MONGODB_URI from .env.local ─────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
let MONGODB_URI = ""
try {
  const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8")
  for (const line of envContent.split("\n")) {
    const t = line.trim()
    if (t.startsWith("MONGODB_URI=")) {
      MONGODB_URI = t.slice("MONGODB_URI=".length).replace(/^["']|["']$/g, "")
      break
    }
  }
} catch {
  console.error("Could not read .env.local")
  process.exit(1)
}
if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in .env.local")
  process.exit(1)
}

// Reference / configuration data that must survive the wipe
const KEEP = ["doctors", "testcatalogs", "users", "clinicsettings"]

// Transactional data to clear
const CLEAR = [
  "patients",
  "appointments",
  "treatments",
  "invoices",
  "auditlogs",
  "patientfiles",
  "whatsappsessions",
  "tempfiles",
  "appointmentrequests",
]

console.log("Connecting to MongoDB…")
await mongoose.connect(MONGODB_URI)
const db = mongoose.connection.db
console.log("Connected.\n")

// ── Snapshot before ──────────────────────────────────────────────────────────
const existing = (await db.listCollections().toArray()).map((c) => c.name).sort()
console.log("Collections found (before):")
for (const name of existing) {
  const count = await db.collection(name).countDocuments()
  const tag = KEEP.includes(name)
    ? "→ KEEP"
    : CLEAR.includes(name)
    ? "→ will CLEAR"
    : "→ kept (not in clear list)"
  console.log(`  ${name.padEnd(22)} ${String(count).padStart(6)} docs   ${tag}`)
}

// ── Clear ────────────────────────────────────────────────────────────────────
console.log("\nClearing transactional data…\n")
let total = 0
for (const col of CLEAR) {
  if (!existing.includes(col)) {
    console.log(`  ${col.padEnd(22)} (no such collection — skipped)`)
    continue
  }
  const res = await db.collection(col).deleteMany({})
  total += res.deletedCount
  console.log(`  ${col.padEnd(22)} cleared ${res.deletedCount} documents`)
}

// ── Verify preserved ─────────────────────────────────────────────────────────
console.log("\nPreserved:")
for (const col of KEEP) {
  if (!existing.includes(col)) continue
  const count = await db.collection(col).countDocuments()
  console.log(`  ${col.padEnd(22)} ${count} docs`)
}

console.log(`\n✅ Done — ${total} documents cleared. Database ready for clean testing.\n`)
await mongoose.disconnect()
