import mongoose, { Schema, Document, Model } from "mongoose"

export interface ITreatment extends Document {
  _id: mongoose.Types.ObjectId
  patientId: string
  doctorId: string
  appointmentId: string
  date: string
  complaint: string
  clinicalNotes: string
  diagnosis: string
  prescribedInstructions: string
  testsRecommended: string[]
  doctorSummary: string
  followUpDate?: string
  attachments: string[]
  status: "pending" | "in-progress" | "completed" | "follow-up-needed"
  createdAt: Date
  updatedAt: Date
}

const TreatmentSchema = new Schema<ITreatment>(
  {
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    appointmentId: { type: String, required: true },
    date: { type: String, required: true },
    complaint: { type: String, default: "" },
    clinicalNotes: { type: String, default: "" },
    diagnosis: { type: String, default: "" },
    prescribedInstructions: { type: String, default: "" },
    testsRecommended: [{ type: String }],
    doctorSummary: { type: String, default: "" },
    followUpDate: { type: String },
    attachments: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "follow-up-needed"],
      default: "pending",
    },
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

const Treatment: Model<ITreatment> =
  mongoose.models.Treatment ||
  mongoose.model<ITreatment>("Treatment", TreatmentSchema)
export default Treatment
