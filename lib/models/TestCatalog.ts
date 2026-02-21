import mongoose, { Schema, Document, Model } from "mongoose"

export interface ITestCatalog extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  category: string
  price: number
  urgencyOptions: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const TestCatalogSchema = new Schema<ITestCatalog>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    urgencyOptions: [{ type: String }],
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

const TestCatalog: Model<ITestCatalog> =
  mongoose.models.TestCatalog ||
  mongoose.model<ITestCatalog>("TestCatalog", TestCatalogSchema)
export default TestCatalog
