import mongoose, { Schema, Document, Model } from "mongoose"

/** Full years between a YYYY-MM-DD date of birth and today. */
function computeAge(dob: string): number {
  if (!dob) return 0
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return 0
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

export interface IPatient extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  phone: string
  email?: string
  gender: "male" | "female" | "other"
  dateOfBirth: string
  age: number
  address?: string
  bloodGroup?: string
  tags: string[]
  notes: string
  assignedDoctorId: string
  medicalHistory: {
    id: string
    date: string
    type: string
    description: string
    addedBy: string
  }[]
  documents: {
    id: string
    name: string
    type: string
    uploadedAt: string
    uploadedBy: string
    url: string
  }[]
  createdAt: Date
  updatedAt: Date
}

const PatientSchema = new Schema<IPatient>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    dateOfBirth: { type: String, required: true },
    age: { type: Number, default: 0 },
    address: { type: String },
    bloodGroup: { type: String },
    tags: [{ type: String }],
    notes: { type: String, default: "" },
    assignedDoctorId: { type: String, default: "" },
    medicalHistory: [
      {
        id: String,
        date: String,
        type: String,
        description: String,
        addedBy: String,
      },
    ],
    documents: [
      {
        id: String,
        name: String,
        type: String,
        uploadedAt: String,
        uploadedBy: String,
        url: String,
        treatmentId: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        // Age is always derived from the date of birth, so patient records
        // stay current automatically as years pass — no scheduled job needed.
        if (ret.dateOfBirth) ret.age = computeAge(ret.dateOfBirth)
        return ret
      },
    },
  }
)

if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as Record<string, unknown>).Patient
}

const Patient: Model<IPatient> =
  mongoose.models.Patient || mongoose.model<IPatient>("Patient", PatientSchema)
export default Patient
