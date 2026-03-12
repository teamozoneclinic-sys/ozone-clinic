import { NextRequest, NextResponse } from "next/server"
import { put, del } from "@vercel/blob"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppWithFileUrl } from "@/lib/whatsapp"
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
      return NextResponse.json({ error: "Failed to parse request body" }, { status: 400 })
    }

    if (!invoiceId || !pdfBase64) {
      return NextResponse.json({ error: "invoiceId and pdfBase64 required" }, { status: 400 })
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

    // Upload receipt image to Vercel Blob to get a public URL for WAWP
    const filename = `receipt-${invoiceRef}.jpg`
    const buffer = Buffer.from(pdfBase64, "base64")
    const { url: blobUrl } = await put(`receipts/${filename}`, buffer, {
      access: "public",
      contentType: "image/jpeg",
    })

    console.log(`[WA PDF] Uploaded to blob: ${blobUrl}`)

    // Send via WAWP /sendFile with the public URL
    const sent = await sendWhatsAppWithFileUrl(
      patient.phone,
      blobUrl,
      filename,
      "image/jpeg",
      caption
    )

    // Delete the blob regardless of send result (fire and forget)
    del(blobUrl).catch((err) => console.error("[WA PDF] Blob delete failed:", err))

    if (!sent) return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[WA PDF] Unhandled error:", err)
    return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 })
  }
}
