import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplateWithDocument } from "@/lib/whatsapp"
import { generateReceiptPDF } from "@/lib/generate-receipt-pdf"
import { put, del } from "@vercel/blob"

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

  // Auto-send WhatsApp receipt with PDF via template — non-blocking
  Promise.all([
    Patient.findById(invoice.patientId),
    ClinicSettings.findOne({}),
    Doctor.findById(invoice.doctorId),
  ]).then(async ([patient, clinic, doctor]) => {
    if (!patient?.phone) return
    const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()

    let blobUrl: string | null = null
    try {
      // Generate PDF
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

      // Upload to Vercel Blob to get a public URL Meta can fetch
      const blob = await put(`receipts/receipt-${invoiceRef}.pdf`, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
      })
      blobUrl = blob.url

      // Send payment_receipt template with document header + body params
      const ok = await sendWhatsAppTemplateWithDocument(
        patient.phone,
        "payment_receipt",
        blobUrl,
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
    } catch (err) {
      console.error("[WhatsApp] Failed to send receipt:", err)
    } finally {
      // Clean up blob after 2 minutes (Meta fetches it quickly)
      if (blobUrl) {
        setTimeout(() => del(blobUrl!).catch(() => {}), 2 * 60 * 1000)
      }
    }
  }).catch((err) => {
    console.error("[WhatsApp] Failed to fetch data for receipt:", err)
  })

  return NextResponse.json({ data: invoice.toJSON() })
}
