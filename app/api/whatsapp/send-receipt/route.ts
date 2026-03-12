import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsApp } from "@/lib/whatsapp"

export function buildReceiptMessage(params: {
  clinicName: string
  clinicPhone?: string
  clinicAddress?: string
  patientName: string
  invoiceRef: string
  invoiceDate: string
  paymentDate: string
  doctorName: string
  doctorSpecialty?: string
  appointmentDate?: string
  appointmentTime?: string
  services: { description: string; quantity: number; amount: number }[]
  totalAmount: number
  paidAmount: number
  balance: number
  paymentMethod: string
  reference?: string
}): string {
  const divider = "━━━━━━━━━━━━━━━━━━━━━"
  const services = params.services
    .map((s) => `  • ${s.description} x${s.quantity} — Rs. ${(s.amount * s.quantity).toLocaleString()}`)
    .join("\n")

  const contact = [
    params.clinicPhone   ? `📞 ${params.clinicPhone}` : "",
    params.clinicAddress ? `📍 ${params.clinicAddress}` : "",
  ].filter(Boolean).join("  |  ")

  return (
    `🧾 *Payment Receipt*\n` +
    `*${params.clinicName}*\n` +
    (contact ? `${contact}\n` : "") +
    `\n${divider}\n` +
    `✅ *PAYMENT CONFIRMED*\n` +
    `${divider}\n\n` +
    `Dear *${params.patientName}*,\n` +
    `Your payment has been received successfully.\n\n` +
    `📋 *Invoice #:* ${params.invoiceRef}\n` +
    `📅 *Invoice Date:* ${params.invoiceDate}\n` +
    `💳 *Payment Date:* ${params.paymentDate}\n\n` +
    `👨‍⚕️ *Doctor:* ${params.doctorName}` +
    (params.doctorSpecialty ? ` (${params.doctorSpecialty})` : "") + `\n` +
    (params.appointmentDate
      ? `🗓️ *Appointment:* ${params.appointmentDate} at ${params.appointmentTime ?? ""}\n`
      : "") +
    `\n${divider}\n` +
    `🛒 *Services:*\n${services}\n` +
    `${divider}\n\n` +
    `💰 *Total Amount:* Rs. ${params.totalAmount.toLocaleString()}\n` +
    `✅ *Amount Paid:* Rs. ${params.paidAmount.toLocaleString()}\n` +
    `📊 *Balance Due:* Rs. ${params.balance.toLocaleString()}\n` +
    `💳 *Payment Method:* ${params.paymentMethod.replace("-", " ")}\n` +
    (params.reference ? `🔖 *Reference:* ${params.reference}\n` : "") +
    `\n${divider}\n\n` +
    `Thank you for choosing *${params.clinicName}*! 🏥\n` +
    `_We appreciate your trust in us. Stay healthy!_ 💚`
  )
}

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

  const [patient, doctor, appointment] = await Promise.all([
    Patient.findById(invoice.patientId),
    invoice.doctorId ? Doctor.findById(invoice.doctorId) : Promise.resolve(null),
    invoice.appointmentId ? Appointment.findOne({ _id: invoice.appointmentId }) : Promise.resolve(null),
  ])

  if (!patient?.phone) return NextResponse.json({ error: "Patient has no phone number" }, { status: 400 })

  const lastPayment = invoice.payments.length > 0
    ? invoice.payments[invoice.payments.length - 1]
    : null

  const message = buildReceiptMessage({
    clinicName: clinic?.name ?? "the Clinic",
    clinicPhone: clinic?.phone,
    clinicAddress: clinic?.address,
    patientName: patient.name,
    invoiceRef: invoice._id.toString().slice(-8).toUpperCase(),
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

  const sent = await sendWhatsApp(patient.phone, message)
  if (!sent) return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 })

  return NextResponse.json({ success: true })
}
