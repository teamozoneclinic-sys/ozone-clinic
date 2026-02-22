import mongoose, { Schema, Document, Model } from "mongoose"

export interface IPatient extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  phone: string
  email?: string
  gender: "male" | "female" | "other"
  age: number
  dateOfBirth: string
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
    age: { type: Number, required: true },
    dateOfBirth: { type: String, default: "" },
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
