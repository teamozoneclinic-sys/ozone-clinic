import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import PatientFile from "@/lib/models/PatientFile"
import TempFile from "@/lib/models/TempFile"
import ClinicSettings from "@/lib/models/ClinicSettings"
import AuditLog from "@/lib/models/AuditLog"
import { requirePermission } from "@/lib/auth"
import { sendWhatsAppWithFileUrl } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/patients/[id]/documents/[docId]/send-whatsapp
 *
 * Sends a patient document (report, lab result, prescription, etc.) to the
 * patient's WhatsApp number with a personalised greeting caption.
 *
 * Architecture note: PatientFile is auth-gated so Meta cannot fetch it
 * directly. We mirror the bytes to a public TempFile (auto-cleanup via TTL
 * index after 1h), give Meta that URL, then schedule an immediate cleanup
 * once Meta has fetched it (~10 min is enough).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const gate = await requirePermission(request, "patients.edit")
  if ("response" in gate) return gate.response
  const { user } = gate

  try {
    const { id, docId } = await params
    await connectDB()

    const patient = await Patient.findById(id)
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    if (!patient.phone) {
      return NextResponse.json(
        { error: "This patient has no phone number on file." },
        { status: 400 }
      )
    }

    // Find the document on the patient record (source of truth for name + treatmentId)
    const doc = patient.documents?.find((d: { id: string }) => d.id === docId)
    if (!doc) {
      return NextResponse.json(
        { error: "Document not found on this patient's record." },
        { status: 404 }
      )
    }

    // Load the binary
    const file = await PatientFile.findById(docId)
    if (!file) {
      return NextResponse.json(
        { error: "Document file is missing from storage." },
        { status: 404 }
      )
    }

    // Mirror to a public temp file Meta can fetch
    const tempFile = await TempFile.create({
      data: file.data,
      contentType: file.contentType,
      filename: file.filename,
    })
    const origin = new URL(request.url).origin
    const fileUrl = `${origin}/api/temp-file/${tempFile._id}`

    // Greeting caption — only images can have captions per Meta API; documents
    // ignore captions (they show a filename instead). We send the greeting in
    // a follow-up text message after the document for documents.
    const clinic = await ClinicSettings.findOne({}).catch(() => null)
    const clinicName = clinic?.name || "Ozone Clinic"
    const greeting =
      `Assalam-o-Alaikum ${patient.name || "Patient"},\n\n` +
      `Please find your report attached: ${doc.name}.\n\n` +
      `For any queries, feel free to contact us.\n— ${clinicName}`

    const isImage = (file.contentType || "").startsWith("image/")

    try {
      await sendWhatsAppWithFileUrl(
        patient.phone,
        fileUrl,
        file.filename,
        file.contentType,
        isImage ? greeting : undefined
      )
      console.log(`[WA Report] ✅ Sent "${file.filename}" to ${patient.phone} (${patient.name})`)
    } catch (err) {
      // Meta error — surface a useful hint for the common "outside 24h window" case
      const message = err instanceof Error ? err.message : "WhatsApp send failed"
      const hint = /re-?engage|24[- ]?hour|outside.*session/i.test(message)
        ? " — the patient hasn't messaged the clinic in the last 24 hours. Ask them to send any message first, then retry."
        : ""
      return NextResponse.json({ error: message + hint }, { status: 502 })
    } finally {
      // Drop the temp mirror once Meta has had time to fetch
      setTimeout(() => {
        TempFile.deleteOne({ _id: tempFile._id }).catch(() => {})
      }, 10 * 60 * 1000)
    }

    // For documents, send the greeting as a follow-up text (captions only work
    // on images). Fire-and-forget — even if this fails the doc was delivered.
    if (!isImage) {
      // Reusing sendWhatsApp would create a circular import-feel; the helper is
      // intentionally local here.
      ;(async () => {
        try {
          const { sendWhatsApp } = await import("@/lib/whatsapp")
          await sendWhatsApp(patient.phone, greeting)
        } catch (err) {
          console.error("[WA Report] Follow-up greeting failed:", err)
        }
      })()
    }

    // Audit
    try {
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "Document Sent via WhatsApp",
        entity: "Patient",
        entityId: id,
        details: `Sent "${file.filename}" to ${patient.name} (${patient.phone}).`,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Audit failure must not affect the response
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[WA Report] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
