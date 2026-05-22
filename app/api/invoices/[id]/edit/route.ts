import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

const VALID_CATEGORIES = ["consultation", "test", "procedure", "discount", "waiver"]

type EditLineItem = {
  id: string
  description: string
  category: string
  amount: number
  quantity: number
}

/**
 * Edit an invoice's line items (admin & manager only). Works on paid and
 * unpaid invoices. Totals, balance, refund-due and status are recomputed from
 * the supplied lines — when a paid invoice is edited below what was already
 * paid, the surplus is tracked as `refundDue`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Only admin and manager can edit invoices" }, { status: 403 })

  await connectDB()
  const { id } = await params
  const body = await request.json()

  const invoice = await Invoice.findById(id)
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  if (invoice.status === "voided")
    return NextResponse.json({ error: "A voided invoice cannot be edited" }, { status: 400 })

  // Normalise the incoming line items
  const rawItems = Array.isArray(body.lineItems) ? body.lineItems : []
  const lineItems: EditLineItem[] = []
  for (let i = 0; i < rawItems.length; i++) {
    const li = rawItems[i] ?? {}
    const description = String(li.description ?? "").trim()
    const amount = Number(li.amount)
    if (!description || !Number.isFinite(amount)) continue
    const quantity = Math.max(1, Math.floor(Number(li.quantity) || 1))
    const category =
      typeof li.category === "string" && VALID_CATEGORIES.includes(li.category)
        ? li.category
        : amount < 0
        ? "discount"
        : "procedure"
    lineItems.push({
      id: typeof li.id === "string" && li.id ? li.id : `li_edit_${Date.now()}_${i}`,
      description,
      category,
      amount,
      quantity,
    })
  }

  if (lineItems.length === 0)
    return NextResponse.json(
      { error: "An invoice must keep at least one valid line item" },
      { status: 400 }
    )

  // Recompute money fields — payments themselves are untouched
  const totalAmount = Math.max(
    0,
    lineItems.reduce((sum, li) => sum + li.amount * li.quantity, 0)
  )
  const paidAmount = invoice.paidAmount ?? 0
  const balance = Math.max(0, totalAmount - paidAmount)
  const refundDue = Math.max(0, paidAmount - totalAmount)
  const status: "unpaid" | "partially-paid" | "paid" =
    balance > 0 ? (paidAmount > 0 ? "partially-paid" : "unpaid") : "paid"

  const previousTotal = invoice.totalAmount

  const updated = await Invoice.findByIdAndUpdate(
    id,
    { lineItems, totalAmount, balance, refundDue, status },
    { new: true }
  )

  try {
    await AuditLog.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Invoice Edited",
      entity: "Invoice",
      entityId: id,
      details:
        `Invoice #${id} edited by ${user.name} (${user.role}). ` +
        `Total Rs. ${previousTotal} → Rs. ${totalAmount}.` +
        (refundDue > 0 ? ` Refund due to patient: Rs. ${refundDue}.` : ""),
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit failure must not block the edit
  }

  return NextResponse.json({ data: updated?.toJSON() })
}
