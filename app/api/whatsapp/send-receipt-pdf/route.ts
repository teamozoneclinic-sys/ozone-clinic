import { NextRequest, NextResponse } from "next/server"
import { put, del } from "@vercel/blob"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import Patient from "@/lib/models/Patient"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppWithFileUrl } from "@/lib/whatsapp"

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

    const patient = await Patient.findById(invoice.patientId)

    if (!patient?.phone) return NextResponse.json({ error: "Patient has no phone number" }, { status: 400 })

    const invoiceRef = invoice._id.toString().slice(-8).toUpperCase()

    // Upload PDF to Vercel Blob to get a public URL for WAWP /sendFile
    const filename = `receipt-${invoiceRef}.pdf`
    const buffer = Buffer.from(pdfBase64, "base64")
    const { url: blobUrl } = await put(`receipts/${filename}`, buffer, {
      access: "public",
      contentType: "application/pdf",
    })

    console.log(`[WA PDF] Uploaded to blob: ${blobUrl}`)

    // Send via WAWP /sendFile — short caption only (full receipt is in the PDF)
    const shortCaption = `Payment receipt from ${clinic?.name ?? "the Clinic"}. Invoice #${invoiceRef}.`
    try {
      await sendWhatsAppWithFileUrl(patient.phone, blobUrl, filename, "application/pdf", shortCaption)
    } finally {
      // Always delete blob whether send succeeded or failed
      del(blobUrl).catch((err) => console.error("[WA PDF] Blob delete failed:", err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[WA PDF] Unhandled error:", err)
    return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 })
  }
}
