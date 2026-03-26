import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"

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

  // Auto-send WhatsApp receipt text via approved template (non-blocking)
  Promise.all([
    Patient.findById(invoice.patientId),
    ClinicSettings.findOne({}),
  ]).then(async ([patient, clinic]) => {
    if (!patient?.phone) return
    const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()
    try {
      const ok = await sendWhatsAppTemplate(
        patient.phone,
        "payment_receipt",
        [
          patient.name,
          String(invoice.paidAmount),
          invoiceRef,
          clinic?.name ?? "the Clinic",
        ]
      )

      if (ok) {
        console.log(`[WhatsApp] ✅ Receipt sent to ${patient.phone} (invoice #${invoiceRef})`)
      }
    } catch (err) {
      console.error("[WhatsApp] Failed to send receipt:", err)
    }
  }).catch((err) => {
    console.error("[WhatsApp] Failed to fetch data for receipt:", err)
  })

  return NextResponse.json({ data: invoice.toJSON() })
}
