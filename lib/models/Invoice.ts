import mongoose, { Schema, Document, Model } from "mongoose"

export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId
  patientId: string
  appointmentId: string
  doctorId: string
  lineItems: {
    id: string
    description: string
    category: "consultation" | "test" | "procedure" | "discount" | "waiver"
    amount: number
    quantity: number
  }[]
  totalAmount: number
  paidAmount: number
  balance: number
  refundDue: number
  status: "unpaid" | "partially-paid" | "paid" | "voided"
  voidedReason?: string
  payments: {
    id: string
    invoiceId: string
    amount: number
    method: string
    reference: string
    notes: string
    collectedBy: string
    collectedAt: string
  }[]
  createdAt: Date
  updatedAt: Date
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    patientId: { type: String, required: true },
    appointmentId: { type: String, default: "" },
    doctorId: { type: String, default: "" },
    lineItems: [
      {
        id: String,
        description: String,
        category: { type: String, enum: ["consultation", "test", "procedure", "discount", "waiver"] },
        amount: Number,
        quantity: { type: Number, default: 1 },
      },
    ],
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    refundDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["unpaid", "partially-paid", "paid", "voided"],
      default: "unpaid",
    },
    voidedReason: { type: String, default: "" },
    payments: [
      {
        id: String,
        invoiceId: String,
        amount: Number,
        method: String,
        reference: String,
        notes: String,
        collectedBy: String,
        collectedAt: String,
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

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema)
export default Invoice
