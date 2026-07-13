import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import ClinicSettings from "@/lib/models/ClinicSettings"
import TempFile from "@/lib/models/TempFile"
import { getRequestUser, requirePermission } from "@/lib/auth"
import { sendWhatsAppTemplateWithDocument } from "@/lib/whatsapp"
import { generateReceiptPDF } from "@/lib/generate-receipt-pdf"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission(request, "billing.collect")
  if ("response" in gate) return gate.response
  const { user } = gate

  await connectDB()
  const { id } = await params
  const body = await request.json()

  const invoice = await Invoice.findById(id)
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const newPayment = {
    id: `pay_${Date.now()}`,
    invoiceId: id,
    amount: body.amount,
    method: body.method,
    reference: body.reference || "",
    notes: body.notes || "",
    collectedBy: user.name,
    collectedAt: new Date().toISOString(),
  }

  const priorPaid = invoice.paidAmount
  const priorBalance = Math.max(0, invoice.totalAmount - priorPaid)
  const newPaid = priorPaid + body.amount
  const newBalance = Math.max(0, invoice.totalAmount - newPaid)
  // Detect overpayment — anything collected beyond the invoice total is a
  // debt to the patient, tracked via `refundDue` and surfaced in the
  // Refunds tab. Client-side normally prevents this but the API must be
  // defensive against direct calls / race conditions.
  const overpayment = Math.max(0, newPaid - invoice.totalAmount)
  const newStatus =
    newBalance <= 0 ? "paid" : newPaid > 0 ? "partially-paid" : "unpaid"

  invoice.payments.push(newPayment as never)
  invoice.paidAmount = newPaid
  invoice.balance = newBalance
  invoice.status = newStatus as "paid" | "partially-paid" | "unpaid"
  if (overpayment > 0) {
    invoice.refundDue = (invoice.refundDue ?? 0) + overpayment
  }
  await invoice.save()

  // Audit the overpayment so admin can see how it arose
  if (overpayment > 0) {
    try {
      const AuditLog = (await import("@/lib/models/AuditLog")).default
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "Overpayment Detected",
        entity: "Invoice",
        entityId: id,
        details:
          `Overpayment of Rs. ${overpayment} on invoice #${id} — collected Rs. ${body.amount} against a remaining balance of Rs. ${priorBalance}. Added to refund-due.`,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Audit failure must not undo the payment
    }
  }

  // Auto-send WhatsApp receipt with PDF — non-blocking
  const origin = new URL(request.url).origin
  Promise.all([
    Patient.findById(invoice.patientId),
    ClinicSettings.findOne({}),
    invoice.doctorId ? Doctor.findById(invoice.doctorId) : Promise.resolve(null),
  ]).then(async ([patient, clinic, doctor]) => {
    if (!patient?.phone) return
    const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()

    try {
      const pdfBuffer = await generateReceiptPDF({
        clinicName: clinic?.name ?? "Clinic",
        invoiceRef,
        patientName: patient.name || "Patient",
        patientPhone: patient.phone,
        doctorName: doctor?.name ?? "Doctor",
        doctorSpecialty: doctor?.specialty,
        invoiceDate: new Date(invoice.createdAt).toLocaleDateString("en-PK", { dateStyle: "long" }),
        paymentDate: new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
        services: invoice.lineItems.map((item: { description: string; quantity: number; amount: number }) => ({
          description: item.description,
          quantity: item.quantity ?? 1,
          amount: item.amount,
        })),
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balance: invoice.balance,
        paymentMethod: body.method || "Cash",
      })

      const tempFile = await TempFile.create({
        data: pdfBuffer,
        contentType: "application/pdf",
        filename: `receipt-${invoiceRef}.pdf`,
      })

      const pdfUrl = `${origin}/api/temp-file/${tempFile._id}`

      const ok = await sendWhatsAppTemplateWithDocument(
        patient.phone,
        "payment_receipt",
        pdfUrl,
        `Receipt-${invoiceRef}.pdf`,
        [
          patient.name || "Patient",
          String(invoice.paidAmount),
          invoiceRef,
          clinic?.name ?? "the Clinic",
        ]
      )

      if (ok) {
        console.log(`[WhatsApp] ✅ Receipt sent to ${patient.phone} (invoice #${invoiceRef})`)
      }

      // Clean up temp file after 10 minutes (Meta fetches it quickly)
      setTimeout(() => {
        TempFile.deleteOne({ _id: tempFile._id }).catch(() => {})
      }, 10 * 60 * 1000)
    } catch (err) {
      console.error("[WhatsApp] Failed to send receipt:", err)
    }
  }).catch((err) => {
    console.error("[WhatsApp] Failed to fetch data for receipt:", err)
  })

  return NextResponse.json({ data: invoice.toJSON() })
}
