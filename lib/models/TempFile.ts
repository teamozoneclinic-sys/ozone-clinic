import mongoose from "mongoose"

// Temporary file storage for WhatsApp PDF sending.
// Auto-deleted after 1 hour via MongoDB TTL index.
const TempFileSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  filename: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
})

export default mongoose.models.TempFile ||
  mongoose.model("TempFile", TempFileSchema)
