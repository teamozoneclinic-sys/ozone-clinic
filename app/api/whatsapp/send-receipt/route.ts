import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import ClinicSettings from "@/lib/models/ClinicSettings"
import TempFile from "@/lib/models/TempFile"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplateWithDocument } from "@/lib/whatsapp"
import { generateReceiptPDF } from "@/lib/generate-receipt-pdf"

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { invoiceId } = await request.json()
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 })

  await connectDB()

  const [invoice, clinic] = await Promise.all([
    Invoice.findById(invoiceId),
    ClinicSettings.findOne({}),
  ])

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const [patient, doctor] = await Promise.all([
    Patient.findById(invoice.patientId),
    invoice.doctorId ? Doctor.findById(invoice.doctorId) : Promise.resolve(null),
  ])

  if (!patient?.phone) return NextResponse.json({ error: "Patient has no phone number" }, { status: 400 })

  const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()
  const lastPayment = invoice.payments.length > 0
    ? invoice.payments[invoice.payments.length - 1]
    : null

  try {
    const pdfBuffer = await generateReceiptPDF({
      clinicName: clinic?.name ?? "Clinic",
      invoiceRef,
      patientName: patient.name || "Patient",
      patientPhone: patient.phone,
      doctorName: doctor?.name ?? "Doctor",
      doctorSpecialty: doctor?.specialty,
      invoiceDate: new Date(invoice.createdAt).toLocaleDateString("en-PK", { dateStyle: "long" }),
      paymentDate: lastPayment
        ? new Date(lastPayment.collectedAt).toLocaleDateString("en-PK", { dateStyle: "long" })
        : new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
      services: invoice.lineItems.map((item: { description: string; quantity: number; amount: number }) => ({
        description: item.description,
        quantity: item.quantity ?? 1,
        amount: item.amount,
      })),
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      balance: invoice.balance,
      paymentMethod: lastPayment?.method || "Cash",
    })

    const origin = new URL(request.url).origin
    const tempFile = await TempFile.create({
      data: pdfBuffer,
      contentType: "application/pdf",
      filename: `receipt-${invoiceRef}.pdf`,
    })

    const pdfUrl = `${origin}/api/temp-file/${tempFile._id}`

    await sendWhatsAppTemplateWithDocument(
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

    setTimeout(() => {
      TempFile.deleteOne({ _id: tempFile._id }).catch(() => {})
    }, 10 * 60 * 1000)

    console.log(`[WhatsApp] ✅ Receipt sent to ${patient.phone} (invoice #${invoiceRef})`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[WhatsApp] Failed to send receipt:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
