import mongoose, { Schema } from "mongoose"

const AppointmentRequestSchema = new Schema(
  {
    name: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "contacted", "booked", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
)

export default mongoose.models.AppointmentRequest ||
  mongoose.model("AppointmentRequest", AppointmentRequestSchema)
