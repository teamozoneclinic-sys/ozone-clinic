import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import { readFileSync } from "fs"
import { resolve } from "path"

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
const MONGODB_URI = env.match(/^MONGODB_URI=(.+)$/m)[1].trim()

const TARGET_EMAIL = "admin@ozoneclinic.com"
const NEW_PASSWORD = "admin123"

const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, lowercase: true }, password: String,
  role: String, doctorId: String, isActive: { type: Boolean, default: true },
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model("User", UserSchema)

await mongoose.connect(MONGODB_URI)
const hash = await bcrypt.hash(NEW_PASSWORD, 12)
const res = await User.updateOne({ email: TARGET_EMAIL }, { $set: { password: hash } })
console.log(`matched=${res.matchedCount} modified=${res.modifiedCount}`)
await mongoose.disconnect()
