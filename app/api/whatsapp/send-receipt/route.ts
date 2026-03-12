import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsApp } from "@/lib/whatsapp"

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { invoiceId } = await request.json()
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 })

  await connectDB()

  const invoice = await Invoice.findById(invoiceId)
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const patient = await Patient.findById(invoice.patientId)
  if (!patient?.phone) return NextResponse.json({ error: "Patient has no phone number" }, { status: 400 })

  const clinicName = process.env.CLINIC_NAME ?? "the Clinic"
  const date = new Date(invoice.createdAt).toLocaleDateString("en-PK")
  const services = invoice.lineItems
    .map((item) => `  • ${item.description} x${item.quantity} — Rs. ${item.amount * item.quantity}`)
    .join("\n")

  const lastPayment = invoice.payments.length > 0
    ? invoice.payments[invoice.payments.length - 1]
    : null

  const message =
    `🧾 *Payment Receipt*\n` +
    `${clinicName}\n\n` +
    `Dear ${patient.name},\n\n` +
    `Thank you for your payment. Here are your receipt details:\n\n` +
    `📋 *Invoice:* #${invoice._id.toString().slice(-6).toUpperCase()}\n` +
    `📅 *Date:* ${date}\n\n` +
    `*Services:*\n${services}\n\n` +
    `💰 *Total Amount:* Rs. ${invoice.totalAmount}\n` +
    `✅ *Paid:* Rs. ${invoice.paidAmount}\n` +
    `📊 *Balance:* Rs. ${invoice.balance}\n` +
    (lastPayment ? `💳 *Payment Method:* ${lastPayment.method.replace("-", " ")}\n` : "") +
    `\nWe appreciate your trust in us. Stay healthy! 🏥`

  const sent = await sendWhatsApp(patient.phone, message)
  if (!sent) return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 })

  return NextResponse.json({ success: true })
}
