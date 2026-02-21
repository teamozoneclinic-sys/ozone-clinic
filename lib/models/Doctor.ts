import mongoose, { Schema, Document, Model } from "mongoose"

export interface IDoctorSchedule {
  day: string
  startTime: string
  endTime: string
}

export interface IDoctor extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  specialty: string
  type: string
  phone: string
  email: string
  consultationFee: number
  schedule: IDoctorSchedule[]
  isActive: boolean
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

const DoctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true },
    type: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    consultationFee: { type: Number, default: 0 },
    schedule: [
      {
        day: String,
        startTime: String,
        endTime: String,
      },
    ],
    isActive: { type: Boolean, default: true },
    avatar: { type: String },
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

const Doctor: Model<IDoctor> =
  mongoose.models.Doctor || mongoose.model<IDoctor>("Doctor", DoctorSchema)
export default Doctor
