import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import { requirePermission } from "@/lib/auth"

/**
 * POST /api/invoices/[id]/void
 *
 * Voids an invoice (paid OR unpaid). Gated by the matrix permission
 * `billing.void` (admin + manager per current ROLE_PERMISSIONS).
 *
 * Side effects:
 *   - status → "voided"
 *   - balance → 0          (removes from outstanding totals)
 *   - voidedReason set
 *   - voidedAt / voidedBy stamped
 *   - if the invoice had been paid, the prior paidAmount is captured as
 *     `refundDue` so the front desk knows money is owed back to the patient.
 *     Revenue charts must filter out voided invoices to honour the user
 *     requirement that voided amounts disappear from revenue.
 *   - audit log entry created
 *
 * Payment history is intentionally preserved on the invoice for traceability
 * — the user can still see what was collected before the void.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePermission(request, "billing.void")
  if ("response" in gate) return gate.response
  const { user } = gate

  await connectDB()
  const { id } = await params

  let body: { reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const reason = (body.reason ?? "").trim()
  if (!reason) {
    return NextResponse.json({ error: "Void reason is required" }, { status: 400 })
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: "Reason must be 500 characters or fewer" }, { status: 400 })
  }

  const invoice = await Invoice.findById(id)
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  if (invoice.status === "voided") {
    return NextResponse.json({ error: "Invoice is already voided" }, { status: 400 })
  }

  const wasPaid = invoice.paidAmount > 0
  const priorBalance = invoice.balance
  const priorPaidAmount = invoice.paidAmount

  invoice.status = "voided"
  invoice.balance = 0
  invoice.voidedReason = reason
  // Capture refund obligation for any money already collected
  if (wasPaid) {
    invoice.refundDue = (invoice.refundDue ?? 0) + priorPaidAmount
  }
  await invoice.save()

  try {
    await AuditLog.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Invoice Voided",
      entity: "Invoice",
      entityId: id,
      details:
        `Invoice #${id} voided by ${user.name} (${user.role}). ` +
        `Reason: ${reason}. ` +
        `Prior totals — paid: Rs.${priorPaidAmount}, balance: Rs.${priorBalance}` +
        (wasPaid ? `. Refund owed to patient: Rs.${priorPaidAmount}.` : "."),
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit failure must not undo the void
  }

  return NextResponse.json({ data: invoice.toJSON() })
}
