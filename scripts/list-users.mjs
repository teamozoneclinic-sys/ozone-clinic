import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI ||
  "mongodb+srv://clinic_user:MEC0RgQuhEkQeVxl@nestnic.sedab5m.mongodb.net/clinic?appName=Nestnic"

const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, lowercase: true }, password: String,
  role: String, doctorId: String, isActive: { type: Boolean, default: true },
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model("User", UserSchema)

await mongoose.connect(MONGODB_URI)
const users = await User.find({}, { name: 1, email: 1, role: 1, isActive: 1, createdAt: 1 }).lean()

console.log(`\nFound ${users.length} users:\n`)
for (const u of users) {
  console.log(`  [${u.role || "?"}]  ${u.email}  —  ${u.name}  (active: ${u.isActive})`)
}
console.log()
await mongoose.disconnect()
