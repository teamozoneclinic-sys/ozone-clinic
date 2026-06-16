import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import { requirePermission } from "@/lib/auth"

/**
 * PATCH /api/patients/[id]/documents/[docId]
 *
 * Updates a single document's metadata on the patient subdoc array.
 * Currently used by the encounter page to link an auto-uploaded document
 * to a newly-created treatment after the consultation is finalised
 * (the upload happens immediately when the doctor picks the file; the
 * treatmentId isn't known until the create-treatment call returns).
 *
 * Body: { treatmentId?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const gate = await requirePermission(request, "patients.edit")
  if ("response" in gate) return gate.response

  try {
    const { id, docId } = await params
    await connectDB()

    let body: { treatmentId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    // Whitelist updatable fields — only treatmentId for now.
    const update: Record<string, string> = {}
    if (typeof body.treatmentId === "string") {
      update["documents.$.treatmentId"] = body.treatmentId
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No updatable fields supplied" }, { status: 400 })
    }

    const patient = await Patient.findOneAndUpdate(
      { _id: id, "documents.id": docId },
      { $set: update },
      { new: true }
    )
    if (!patient) {
      return NextResponse.json(
        { error: "Patient or document not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: patient.toJSON() })
  } catch (err) {
    console.error("[Documents] PATCH error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
