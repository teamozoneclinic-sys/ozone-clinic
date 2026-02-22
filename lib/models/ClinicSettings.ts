import mongoose, { Schema, Document, Model } from "mongoose"

export interface IClinicSettings extends Document {
  name: string
  address: string
  phone: string
  email: string
  website?: string
  logo?: string // base64 data-URL or empty
}

const ClinicSettingsSchema = new Schema<IClinicSettings>(
  {
    name: { type: String, default: "HealthCare Clinic" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    logo: { type: String, default: "" },
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
  delete (mongoose.models as Record<string, unknown>).ClinicSettings
}

const ClinicSettings: Model<IClinicSettings> =
  mongoose.models.ClinicSettings ||
  mongoose.model<IClinicSettings>("ClinicSettings", ClinicSettingsSchema)

export default ClinicSettings
