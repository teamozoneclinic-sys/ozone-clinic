import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplateWithDocument } from "@/lib/whatsapp"
import { generateReceiptPDF } from "@/lib/generate-receipt-pdf"
import TempFile from "@/lib/models/TempFile"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  const newPaid = invoice.paidAmount + body.amount
  const newBalance = Math.max(0, invoice.totalAmount - newPaid)
  const newStatus =
    newBalance <= 0 ? "paid" : newPaid > 0 ? "partially-paid" : "unpaid"

  invoice.payments.push(newPayment as never)
  invoice.paidAmount = newPaid
  invoice.balance = newBalance
  invoice.status = newStatus as "paid" | "partially-paid" | "unpaid"
  await invoice.save()

  // Auto-send WhatsApp receipt with PDF (non-blocking)
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
  Promise.all([
    Patient.findById(invoice.patientId),
    invoice.doctorId ? Doctor.findById(invoice.doctorId) : Promise.resolve(null),
    invoice.appointmentId ? Appointment.findOne({ _id: invoice.appointmentId }) : Promise.resolve(null),
    ClinicSettings.findOne({}),
  ]).then(async ([patient, doctor, appointment, clinic]) => {
    if (!patient?.phone) return
    const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()
    try {
      // Generate PDF server-side
      const pdfBuffer = await generateReceiptPDF({
        clinicName: clinic?.name ?? "Clinic",
        invoiceRef,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor?.name ?? "—",
        doctorSpecialty: doctor?.specialty,
        invoiceDate: new Date(invoice.createdAt).toLocaleDateString("en-PK", { dateStyle: "medium" }),
        paymentDate: new Date(newPayment.collectedAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }),
        appointmentDate: appointment?.date,
        appointmentTime: appointment?.time,
        services: invoice.lineItems.map((item: { description: string; quantity: number; amount: number }) => ({
          description: item.description,
          quantity: item.quantity,
          amount: item.amount,
        })),
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balance: invoice.balance,
        paymentMethod: newPayment.method,
      })

      // Store in MongoDB temporarily
      const tempFile = await TempFile.create({
        data: pdfBuffer,
        contentType: "application/pdf",
        filename: `receipt-${invoiceRef}.pdf`,
      })
      const fileUrl = `${appBaseUrl}/api/temp-file/${tempFile._id}`

      // Send via Meta template with PDF header
      const ok = await sendWhatsAppTemplateWithDocument(
        patient.phone,
        "payment_receipt",
        fileUrl,
        `receipt-${invoiceRef}.pdf`,
        [
          patient.name,
          String(invoice.paidAmount),
          invoiceRef,
          clinic?.name ?? "the Clinic",
        ]
      )

      TempFile.deleteOne({ _id: tempFile._id }).catch(() => {})

      if (ok) {
        console.log(`[WhatsApp] ✅ Receipt PDF sent to ${patient.phone} (invoice #${invoiceRef})`)
      }
    } catch (err) {
      console.error("[WhatsApp] Failed to send receipt:", err)
    }
  }).catch((err) => {
    console.error("[WhatsApp] Failed to fetch data for receipt:", err)
  })

  return NextResponse.json({ data: invoice.toJSON() })
}
