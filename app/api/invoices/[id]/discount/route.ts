import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!["admin", "manager", "receptionist"].includes(user.role))
    return NextResponse.json({ error: "Only admin, manager and receptionist can apply discounts" }, { status: 403 })

  await connectDB()
  const { id } = await params
  const { description, amount, appliedBy } = await request.json()

  if (!description || !amount || amount <= 0)
    return NextResponse.json({ error: "Description and positive amount are required" }, { status: 400 })

  const invoice = await Invoice.findById(id)
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (invoice.status === "voided") return NextResponse.json({ error: "Cannot discount a voided invoice" }, { status: 400 })
  if (invoice.status === "paid") return NextResponse.json({ error: "Cannot discount a paid invoice" }, { status: 400 })

  const discountItem = {
    id: `li_disc_${Date.now()}`,
    description: `Discount: ${description} (by ${appliedBy})`,
    category: "discount",
    amount: -Math.abs(amount),
    quantity: 1,
  }

  const allLineItems = [...(invoice.lineItems ?? []), discountItem]
  const newTotal = Math.max(
    0,
    allLineItems.reduce((sum: number, li: { amount: number; quantity: number }) => sum + li.amount * li.quantity, 0)
  )
  const newBalance = Math.max(0, newTotal - (invoice.paidAmount ?? 0))
  let newStatus: string = invoice.status
  if (newBalance === 0 && (invoice.paidAmount ?? 0) > 0) newStatus = "paid"
  else if (newBalance > 0 && newBalance < newTotal) newStatus = "partially-paid"
  else if (newBalance === newTotal) newStatus = "unpaid"

  const updated = await Invoice.findByIdAndUpdate(
    id,
    { lineItems: allLineItems, totalAmount: newTotal, balance: newBalance, status: newStatus },
    { new: true }
  )

  await AuditLog.create({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "Discount Applied",
    entity: "Invoice",
    entityId: id,
    details: `Discount of Rs. ${amount} applied to invoice #${id}. Reason: ${description}.`,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ data: updated?.toJSON() })
}
