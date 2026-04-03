import mongoose, { Schema } from "mongoose"

const WhatsAppSessionSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  state: {
    type: String,
    enum: ["awaiting_response", "awaiting_name", "awaiting_dob"],
    required: true,
  },
  collectedName: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // auto-delete after 1 hour
})

export default mongoose.models.WhatsAppSession ||
  mongoose.model("WhatsAppSession", WhatsAppSessionSchema)
