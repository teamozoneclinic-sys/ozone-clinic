import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import ClinicSettings from "@/lib/models/ClinicSettings"
import TempFile from "@/lib/models/TempFile"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplateWithDocument } from "@/lib/whatsapp"

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
    } catch {
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

    const patient = await Patient.findById(invoice.patientId)
    if (!patient?.phone) return NextResponse.json({ error: "Patient has no phone number" }, { status: 400 })

    const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()
    const filename = `receipt-${invoiceRef}.pdf`
    const buffer = Buffer.from(pdfBase64, "base64")

    const origin = new URL(request.url).origin
    const tempFile = await TempFile.create({
      data: buffer,
      contentType: "application/pdf",
      filename,
    })

    const fileUrl = `${origin}/api/temp-file/${tempFile._id}`
    console.log(`[WA PDF] Stored temp file: ${tempFile._id}, URL: ${fileUrl}`)

    try {
      await sendWhatsAppTemplateWithDocument(
        patient.phone,
        "payment_receipt",
        fileUrl,
        filename,
        [
          patient.name || "Patient",
          String(invoice.paidAmount),
          invoiceRef,
          clinic?.name ?? "the Clinic",
        ]
      )
      console.log(`[WA PDF] ✅ Receipt PDF sent to ${patient.phone} for invoice #${invoiceRef}`)
      return NextResponse.json({ success: true })
    } finally {
      setTimeout(() => {
        TempFile.deleteOne({ _id: tempFile._id }).catch(() => {})
      }, 10 * 60 * 1000)
    }
  } catch (err) {
    console.error("[WA PDF] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
