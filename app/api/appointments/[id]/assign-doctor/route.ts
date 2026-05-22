import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Doctor from "@/lib/models/Doctor"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

/**
 * Assign a doctor to an appointment that was booked without one.
 * Ensures the appointment's invoice carries a consultation charge for that
 * doctor — adding it to an existing (procedure-only) invoice, or creating a
 * fresh invoice when none exists yet.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Only admin and manager can assign doctors" }, { status: 403 })

  await connectDB()
  const { id } = await params
  const { doctorId } = await request.json()
  if (!doctorId) return NextResponse.json({ error: "A doctor is required" }, { status: 400 })

  const [appointment, doctor] = await Promise.all([
    Appointment.findById(id),
    Doctor.findById(doctorId),
  ])
  if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 })

  appointment.doctorId = doctorId

  const consultationItem = {
    id: `li_${Date.now()}`,
    description: `Consultation - ${doctor.specialty}`,
    category: "consultation",
    amount: doctor.consultationFee,
    quantity: 1,
  }

  // Ensure the invoice carries a consultation charge for this doctor
  let invoiceJSON: unknown = null
  const existingInvoice = appointment.invoiceId
    ? await Invoice.findById(appointment.invoiceId)
    : null

  if (existingInvoice) {
    const hasConsultation = (existingInvoice.lineItems ?? []).some(
      (li: { category: string }) => li.category === "consultation"
    )
    if (!hasConsultation && existingInvoice.status !== "voided") {
      const lineItems = [consultationItem, ...(existingInvoice.lineItems ?? [])]
      const totalAmount = Math.max(
        0,
        lineItems.reduce(
          (sum: number, li: { amount: number; quantity: number }) => sum + li.amount * li.quantity,
          0
        )
      )
      const paidAmount = existingInvoice.paidAmount ?? 0
      const balance = Math.max(0, totalAmount - paidAmount)
      const status =
        balance === 0 && paidAmount > 0 ? "paid" : paidAmount > 0 ? "partially-paid" : "unpaid"
      const updated = await Invoice.findByIdAndUpdate(
        existingInvoice._id,
        { lineItems, totalAmount, balance, status, doctorId },
        { new: true }
      )
      invoiceJSON = updated?.toJSON() ?? null
    } else {
      // Already has a consultation (or is voided) — just record the doctor
      const updated = await Invoice.findByIdAndUpdate(
        existingInvoice._id,
        { doctorId },
        { new: true }
      )
      invoiceJSON = updated?.toJSON() ?? null
    }
  } else {
    // No invoice yet — create one with the consultation charge
    const created = await Invoice.create({
      patientId: appointment.patientId,
      appointmentId: appointment._id.toString(),
      doctorId,
      lineItems: [consultationItem],
      totalAmount: doctor.consultationFee,
      paidAmount: 0,
      balance: doctor.consultationFee,
      status: "unpaid",
      payments: [],
    })
    appointment.invoiceId = created._id.toString()
    invoiceJSON = created.toJSON()
  }

  await appointment.save()

  try {
    await AuditLog.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Doctor Assigned",
      entity: "Appointment",
      entityId: id,
      details: `Dr. ${doctor.name} assigned to appointment by ${user.name} (${user.role}).`,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit failure must not block the assignment
  }

  return NextResponse.json({ data: appointment.toJSON(), invoice: invoiceJSON })
}
