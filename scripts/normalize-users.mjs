/**
 * Normalize every user account:
 *   - email  → <local-part>@ozoneclinic.com   (local part kept, domain forced)
 *   - password → "admin123" for the admin, "user123" for everyone else
 *
 * Safe to re-run. Aborts without changes if two users would collide on the
 * same normalized email, or if an existing email is unparseable.
 *
 *   node scripts/normalize-users.mjs
 */
import mongoose from "mongoose"
import bcrypt from "bcryptjs"

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://clinic_user:MEC0RgQuhEkQeVxl@nestnic.sedab5m.mongodb.net/clinic?appName=Nestnic"

const TARGET_DOMAIN = "ozoneclinic.com"
const BCRYPT_ROUNDS = 12

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, lowercase: true },
    password: String,
    role: String,
    doctorId: String,
    isActive: Boolean,
  },
  { timestamps: true }
)
const User = mongoose.models.User || mongoose.model("User", UserSchema)

await mongoose.connect(MONGODB_URI)

const users = await User.find({}).lean()
console.log(`\nFound ${users.length} users.\n`)

// Build the change plan
const plan = users.map((u) => {
  const local = String(u.email || "").split("@")[0].toLowerCase().trim()
  return {
    u,
    local,
    newEmail: `${local}@${TARGET_DOMAIN}`,
    newPasswordPlain: u.role === "admin" ? "admin123" : "user123",
  }
})

// Pre-flight checks — abort entirely if anything is unsafe
const seen = new Map()
let unsafe = false
for (const p of plan) {
  if (!p.local) {
    console.log(`  ⚠ "${p.u.name}" has an unparseable email ("${p.u.email}") — cannot normalize.`)
    unsafe = true
  }
  if (seen.has(p.newEmail)) {
    console.log(`  ⚠ COLLISION: "${p.newEmail}" wanted by both "${seen.get(p.newEmail)}" and "${p.u.name}".`)
    unsafe = true
  } else {
    seen.set(p.newEmail, p.u.name)
  }
}
if (unsafe) {
  console.log("\n❌ Aborted — no changes made. Resolve the issues above and re-run.\n")
  await mongoose.disconnect()
  process.exit(1)
}

// Apply
console.log("Applying changes:\n")
for (const { u, newEmail, newPasswordPlain } of plan) {
  const hash = await bcrypt.hash(newPasswordPlain, BCRYPT_ROUNDS)
  await User.updateOne({ _id: u._id }, { $set: { email: newEmail, password: hash } })
  const changed = u.email !== newEmail
  console.log(`  [${u.role}]  ${u.name}`)
  console.log(`      email    : ${u.email}  ${changed ? `→  ${newEmail}` : "(already correct)"}`)
  console.log(`      password : reset → "${newPasswordPlain}"`)
  if (u.role === "doctor" && !u.doctorId) {
    console.log(`      note     : this doctor user has no doctorId link`)
  }
}

console.log(`\n✅ Done. ${users.length} users normalized to @${TARGET_DOMAIN}.\n`)
await mongoose.disconnect()
