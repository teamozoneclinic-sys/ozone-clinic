import mongoose, { Schema, Document, Model } from "mongoose"

/**
 * External doctors who refer patients to the clinic. Populated by staff via
 * the Reference Doctors page, then surfaced as suggestions in the "Referred
 * By" field of the appointment booking modal. Referral counts are computed
 * server-side by matching `Appointment.referral` (a free-text string) against
 * a reference doctor's name (case-insensitive).
 */
export interface IReferenceDoctor extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  phone: string
  email: string
  specialty: string
  hospital: string
  notes: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const ReferenceDoctorSchema = new Schema<IReferenceDoctor>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    specialty: { type: String, default: "" },
    hospital: { type: String, default: "" },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
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

ReferenceDoctorSchema.index({ name: 1 })

// Dev HMR safety — mirror the pattern used in other models
if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as Record<string, unknown>).ReferenceDoctor
}

const ReferenceDoctor: Model<IReferenceDoctor> =
  mongoose.models.ReferenceDoctor ||
  mongoose.model<IReferenceDoctor>("ReferenceDoctor", ReferenceDoctorSchema)

export default ReferenceDoctor
