/**
 * Clear all clinic data from MongoDB.
 * Preserves the admin user account so you can still log in.
 *
 * Usage:
 *   node scripts/clear-db.mjs
 *
 * Requires MONGODB_URI in .env.local (reads it automatically).
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import mongoose from "mongoose"

// ── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, "../.env.local")

let MONGODB_URI = ""
try {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("MONGODB_URI=")) {
      MONGODB_URI = trimmed.slice("MONGODB_URI=".length).replace(/^["']|["']$/g, "")
      break
    }
  }
} catch {
  console.error("Could not read .env.local — make sure it exists.")
  process.exit(1)
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in .env.local")
  process.exit(1)
}

// ── Connect ──────────────────────────────────────────────────────────────────
console.log("Connecting to MongoDB…")
await mongoose.connect(MONGODB_URI)
console.log("Connected.")

const db = mongoose.connection.db

// ── Collections to wipe ──────────────────────────────────────────────────────
const WIPE_COLLECTIONS = [
  "patients",
  "doctors",
  "appointments",
  "treatments",
  "invoices",
  "testcatalogs",
]

for (const col of WIPE_COLLECTIONS) {
  const result = await db.collection(col).deleteMany({})
  console.log(`  ${col}: deleted ${result.deletedCount} documents`)
}

// ── Users: delete all non-admin accounts ─────────────────────────────────────
const usersResult = await db.collection("users").deleteMany({ role: { $ne: "admin" } })
console.log(`  users (non-admin): deleted ${usersResult.deletedCount} documents`)

console.log("\nDatabase cleared. Admin user(s) preserved.")
await mongoose.disconnect()
