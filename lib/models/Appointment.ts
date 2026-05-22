import mongoose, { Schema, Document, Model } from "mongoose"

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId
  patientId: string
  doctorId: string
  date: string
  time: string
  duration: number
  status: "scheduled" | "checked-in" | "in-progress" | "completed" | "cancelled" | "no-show"
  type: string
  notes: string
  receptionNotes: string
  doctorNotes: string
  referral: string
  invoiceId: string
  whatsappAcknowledgedBy: string
  whatsappAcknowledgedAt: string
  createdAt: Date
  updatedAt: Date
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientId: { type: String, required: true },
    doctorId: { type: String, default: "" },
    date: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ["scheduled", "checked-in", "in-progress", "completed", "cancelled", "no-show"],
      default: "scheduled",
    },
    type: { type: String, default: "" },
    notes: { type: String, default: "" },
    receptionNotes: { type: String, default: "" },
    doctorNotes: { type: String, default: "" },
    referral: { type: String, default: "" },
    invoiceId: { type: String, default: "" },
    whatsappAcknowledgedBy: { type: String, default: "" },
    whatsappAcknowledgedAt: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as Record<string, unknown>).Appointment
}

const Appointment: Model<IAppointment> =
  mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema)
export default Appointment
