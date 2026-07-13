import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import PatientFile from "@/lib/models/PatientFile"
import TempFile from "@/lib/models/TempFile"
import ClinicSettings from "@/lib/models/ClinicSettings"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppWithFileUrl } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/patients/[id]/documents/[docId]/send-whatsapp
 *
 * Sends a patient document (report, lab result, prescription, etc.) to the
 * patient's WhatsApp with a personalised greeting caption.
 *
 * Access: ANY authenticated user may send a report (per user spec — every
 * role in the clinic needs this capability to help patients). No permission
 * gate beyond a valid session.
 *
 * Architecture note: PatientFile is auth-gated so Meta cannot fetch it
 * directly. We mirror the bytes to a public TempFile (auto-cleanup via TTL
 * index after 1h), give Meta that URL, then schedule an eager cleanup once
 * Meta has had time to fetch it (~10 min).
 *
 * Delivery constraint (Meta rule): freeform media only reaches the patient
 * if they have messaged the clinic within the last 24 hours (the "customer
 * service window"). Outside that window Meta returns error 131047. The only
 * bypass is an approved template with a document header — set
 * `WA_REPORT_TEMPLATE=<template_name>` to enable that path.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  // Any authenticated user may send — per user spec.
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

    // Find the document metadata on the patient record
    const doc = patient.documents?.find((d: { id: string }) => d.id === docId)
    if (!doc) {
      return NextResponse.json(
        { error: "Document not found on this patient's record." },
        { status: 404 }
      )
    }

    // Load the binary from PatientFile store
    const file = await PatientFile.findById(docId)
    if (!file) {
      return NextResponse.json(
        { error: "Document file is missing from storage." },
        { status: 404 }
      )
    }

    // Mirror to a public TempFile so Meta can fetch without auth
    const tempFile = await TempFile.create({
      data: file.data,
      contentType: file.contentType,
      filename: file.filename,
    })
    const origin = new URL(request.url).origin
    const fileUrl = `${origin}/api/temp-file/${tempFile._id}`

    const clinic = await ClinicSettings.findOne({}).catch(() => null)
    const clinicName = clinic?.name || "Ozone Clinic"

    // Greeting caption — Meta docs confirm both `image` and `document` types
    // support a `caption` field on the media message. No follow-up text needed.
    const caption =
      `Assalam-o-Alaikum ${patient.name || "Patient"},\n\n` +
      `Please find your report attached: ${doc.name}.\n\n` +
      `For any queries, feel free to contact us.\n— ${clinicName}`

    console.log(
      `[WA Report] Sending "${file.filename}" (${file.contentType}, ${file.data?.length ?? "?"} bytes) ` +
        `→ ${patient.phone} (${patient.name}). Meta will fetch: ${fileUrl}`
    )

    let sendError: Error | null = null
    try {
      await sendWhatsAppWithFileUrl(
        patient.phone,
        fileUrl,
        file.filename,
        file.contentType,
        caption
      )
      console.log(`[WA Report] ✅ Delivered "${file.filename}" to ${patient.phone}`)
    } catch (err) {
      sendError = err instanceof Error ? err : new Error(String(err))
      console.error(`[WA Report] ❌ Meta rejected send:`, sendError.message)
    } finally {
      // Cleanup the temp mirror once Meta has had time to fetch (10 min buffer)
      setTimeout(() => {
        TempFile.deleteOne({ _id: tempFile._id }).catch(() => {})
      }, 10 * 60 * 1000)
    }

    // Audit — always write, success or failure, so admin can see attempts
    try {
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: sendError ? "Document Send Failed (WhatsApp)" : "Document Sent via WhatsApp",
        entity: "Patient",
        entityId: id,
        details: sendError
          ? `Failed to send "${file.filename}" to ${patient.name} (${patient.phone}): ${sendError.message}`
          : `Sent "${file.filename}" to ${patient.name} (${patient.phone}).`,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Audit failure must not affect the response
    }

    if (sendError) {
      // Translate common Meta errors into actionable messages for the front desk
      const msg = sendError.message
      let userFacing = msg
      if (/131047|re-?engage|24[- ]?hour|outside.*session|does not have.*permitted/i.test(msg)) {
        userFacing =
          "Message not delivered — the patient hasn't messaged the clinic in the last 24 hours. " +
          "Ask them to send any WhatsApp message first, then retry."
      } else if (/131026|not.*whatsapp|invalid.*recipient|invalid.*phone/i.test(msg)) {
        userFacing =
          "Message not delivered — this phone number isn't registered on WhatsApp or the format is invalid."
      } else if (/media.*download|could not.*download|failed.*download/i.test(msg)) {
        userFacing =
          "Message not delivered — Meta couldn't download the file. This usually means the server URL isn't reachable from the internet. Contact your admin."
      } else if (/131000|internal.*meta|unknown/i.test(msg)) {
        userFacing = "Message not delivered — Meta had a temporary error. Please retry in a minute."
      }
      return NextResponse.json({ error: userFacing, metaError: msg }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[WA Report] Server error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
