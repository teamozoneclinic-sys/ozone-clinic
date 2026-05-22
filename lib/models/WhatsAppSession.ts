import mongoose, { Schema } from "mongoose"

const WhatsAppSessionSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  state: {
    type: String,
    enum: [
      "awaiting_language",
      "awaiting_response",
      "awaiting_name",
      "awaiting_gender",
      "awaiting_age",
      "awaiting_procedure",
      "awaiting_date",
      "awaiting_time",
      "awaiting_confirm",
    ],
    required: true,
  },
  language: { type: String, enum: ["en", "ur"], default: "en" },

  // Collected during patient registration
  collectedName: { type: String },
  collectedGender: { type: String },
  collectedAge: { type: Number },

  // Resolved patient (existing or just-registered)
  patientId: { type: String },

  // Booking selections
  procedureId: { type: String },
  procedureName: { type: String },
  procedurePrice: { type: Number },
  selectedDate: { type: String }, // YYYY-MM-DD
  selectedTime: { type: String }, // HH:MM

  createdAt: { type: Date, default: Date.now, expires: 3600 }, // auto-delete after 1 hour
})

// In development, drop the cached model so schema changes (new states/fields) apply
if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as Record<string, unknown>).WhatsAppSession
}

export default mongoose.models.WhatsAppSession ||
  mongoose.model("WhatsAppSession", WhatsAppSessionSchema)
