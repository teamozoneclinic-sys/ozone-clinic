import mongoose, { Schema, Document, Model } from "mongoose"

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId
  userId: string
  userName: string
  userRole: string
  action: string
  entity: string
  entityId: string
  details: string
  timestamp: string
  createdAt: Date
  updatedAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    details: { type: String, default: "" },
    timestamp: { type: String, required: true },
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

// Index — audit log is always read sorted by recent timestamp.
AuditLogSchema.index({ timestamp: -1 })

if (process.env.NODE_ENV !== "production") {
  delete (mongoose.models as Record<string, unknown>).AuditLog
}

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema)
export default AuditLog
