import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppWithImage } from "@/lib/whatsapp"
import { buildReceiptMessage } from "@/lib/receipt-message"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let invoiceId: string, pdfBase64: string
  try {
    const body = await request.json()
    invoiceId = body.invoiceId
    pdfBase64 = body.pdfBase64
  } catch (parseErr) {
    console.error("[WA PDF] Body parse error:", parseErr)
    return NextResponse.json({ error: "Failed to parse request body", detail: String(parseErr) }, { status: 400 })
  }

  if (!invoiceId || !pdfBase64) {
    return NextResponse.json({ error: "invoiceId and pdfBase64 required" }, { status: 400 })
  }

  console.log(`[WA PDF] invoiceId=${invoiceId}, base64Length=${pdfBase64.length}`)

  if (!process.env.WAWP_IMAGE_URL || !process.env.WAWP_INSTANCE_ID || !process.env.WAWP_ACCESS_TOKEN) {
    console.error("[WA PDF] Missing env vars:", {
      WAWP_IMAGE_URL: process.env.WAWP_IMAGE_URL ?? "MISSING",
      WAWP_INSTANCE_ID: process.env.WAWP_INSTANCE_ID ? "set" : "MISSING",
      WAWP_ACCESS_TOKEN: process.env.WAWP_ACCESS_TOKEN ? "set" : "MISSING",
    })
    return NextResponse.json({ error: "WhatsApp not configured (missing env vars)" }, { status: 500 })
  }

  await connectDB()

  const [invoice, clinic] = await Promise.all([
    Invoice.findById(invoiceId),
    ClinicSettings.findOne({}),
  ])

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const [patient, doctor, appointment] = await Promise.all([
    Patient.findById(invoice.patientId),
    invoice.doctorId ? Doctor.findById(invoice.doctorId) : Promise.resolve(null),
    invoice.appointmentId ? Appointment.findOne({ _id: invoice.appointmentId }) : Promise.resolve(null),
  ])

  if (!patient?.phone) return NextResponse.json({ error: "Patient has no phone number" }, { status: 400 })

  const lastPayment = invoice.payments.length > 0
    ? invoice.payments[invoice.payments.length - 1]
    : null

  const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()
  const caption = buildReceiptMessage({
    clinicName: clinic?.name ?? "the Clinic",
    clinicPhone: clinic?.phone,
    clinicAddress: clinic?.address,
    patientName: patient.name,
    invoiceRef,
    invoiceDate: new Date(invoice.createdAt).toLocaleDateString("en-PK", { dateStyle: "medium" }),
    paymentDate: lastPayment
      ? new Date(lastPayment.collectedAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
      : new Date().toLocaleDateString("en-PK", { dateStyle: "medium" }),
    doctorName: doctor?.name ?? "—",
    doctorSpecialty: doctor?.specialty,
    appointmentDate: appointment?.date,
    appointmentTime: appointment?.time,
    services: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      amount: item.amount,
    })),
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    balance: invoice.balance,
    paymentMethod: lastPayment?.method ?? "—",
    reference: lastPayment?.reference,
  })

  // Send as JPEG image (receipt screenshot) — small enough for WhatsApp
  const sent = await sendWhatsAppWithImage(
    patient.phone,
    caption,
    pdfBase64,
    `receipt-${invoiceRef}.jpg`
  )

  if (!sent) return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 })

  return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[WA PDF] Unhandled error:", err)
    return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 })
  }
}
