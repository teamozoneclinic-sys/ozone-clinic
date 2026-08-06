import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser, userHasPermission } from "@/lib/auth"

/**
 * POST /api/invoices/[id]/mark-refunded
 *
 * Marks an invoice's outstanding refund obligation as paid out to the patient.
 * Called when the front desk has physically handed the cash back (or issued
 * a transfer). Gated by `billing.void` — same tier as the void action itself
 * so admin + manager can process refunds, matching the matrix.
 *
 * Body: { notes?: string, reference?: string }
 *
 * Side effects:
 *   - refundedAt / refundedBy / refundedAmount / refundedNotes / refundedReference stamped
 *   - refundDue → 0 (obligation cleared)
 *   - Audit log entry created
 *
 * Preconditions:
 *   - invoice must have refundDue > 0
 *   - invoice must not already be marked refunded
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Marking a refund as paid out is a cash-desk action: admin + manager (via
  // billing.void) already have this; the accounts / cashier role also needs
  // it since they physically hand the money back to the patient. Matrix
  // permissions are NOT modified — this is a targeted role widening for the
  // refund payout action only. Voiding invoices still remains billing.void.
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const isCashier = user.role === "accounts"
  if (!userHasPermission(user, "billing.void") && !isCashier) {
    return NextResponse.json(
      { error: `Forbidden — your role (${user.role}) cannot mark refunds as paid out.` },
      { status: 403 }
    )
  }

  await connectDB()
  const { id } = await params

  let body: { notes?: string; reference?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const notes = (body.notes ?? "").trim().slice(0, 500)
  const reference = (body.reference ?? "").trim().slice(0, 120)

  const invoice = await Invoice.findById(id)
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const owed = invoice.refundDue ?? 0
  if (owed <= 0) {
    return NextResponse.json(
      { error: "No refund is owed on this invoice." },
      { status: 400 }
    )
  }
  if (invoice.refundedAt) {
    return NextResponse.json(
      { error: "This refund has already been marked as paid out." },
      { status: 400 }
    )
  }

  invoice.refundedAt = new Date().toISOString()
  invoice.refundedBy = user.name
  invoice.refundedAmount = owed
  invoice.refundedNotes = notes
  invoice.refundedReference = reference
  invoice.refundDue = 0
  await invoice.save()

  try {
    await AuditLog.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Refund Paid Out",
      entity: "Invoice",
      entityId: id,
      details:
        `Refund of Rs. ${owed} paid out to patient for invoice #${id} by ${user.name} (${user.role}). ` +
        (reference ? `Reference: ${reference}. ` : "") +
        (notes ? `Notes: ${notes}` : ""),
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit failure must not undo the refund mark
  }

  return NextResponse.json({ data: invoice.toJSON() })
}
