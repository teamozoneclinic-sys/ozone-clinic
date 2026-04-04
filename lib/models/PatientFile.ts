import mongoose, { Schema } from "mongoose"

const PatientFileSchema = new Schema(
  {
    patientId: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
)

export default mongoose.models.PatientFile ||
  mongoose.model("PatientFile", PatientFileSchema)
