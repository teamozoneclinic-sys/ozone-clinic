import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import PatientFile from "@/lib/models/PatientFile"
import { getRequestUser } from "@/lib/auth"

export const maxDuration = 30

// POST /api/patients/[id]/documents  — upload a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await connectDB()

    let body: { filename?: string; contentType?: string; data?: string; treatmentId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Request body too large or malformed. Try a smaller file (under 4 MB)." },
        { status: 413 }
      )
    }

    const { filename, contentType, data: base64, treatmentId } = body
    if (!filename || !contentType || !base64)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    // Check decoded size — Vercel has ~4.5 MB body limit; base64 inflates ~33%
    const estimatedBytes = Math.ceil((base64.length * 3) / 4)
    if (estimatedBytes > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum is 10 MB." }, { status: 413 })
    }

    const buffer = Buffer.from(base64, "base64")

    const file = await PatientFile.create({ patientId: id, filename, contentType, data: buffer })

    const origin = new URL(request.url).origin
    const newDoc = {
      id: file._id.toString(),
      name: filename,
      type: contentType,
      uploadedAt: new Date().toISOString().split("T")[0],
      uploadedBy: user.name || user.email,
      url: `${origin}/api/patient-files/${file._id}`,
      treatmentId: typeof treatmentId === "string" ? treatmentId : "",
    }

    const patient = await Patient.findByIdAndUpdate(
      id,
      { $push: { documents: newDoc } },
      { returnDocument: "after" }
    )
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

    return NextResponse.json({ data: patient.toJSON() })
  } catch (err) {
    console.error("[Documents] POST error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/patients/[id]/documents?docId=xxx  — remove a document (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "admin")
      return NextResponse.json({ error: "Only admin can delete patient documents" }, { status: 403 })

    const { id } = await params
    const docId = new URL(request.url).searchParams.get("docId")
    if (!docId) return NextResponse.json({ error: "Missing docId" }, { status: 400 })

    await connectDB()

    await PatientFile.findByIdAndDelete(docId).catch(() => null)

    const patient = await Patient.findByIdAndUpdate(
      id,
      { $pull: { documents: { id: docId } } },
      { returnDocument: "after" }
    )
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

    return NextResponse.json({ data: patient.toJSON() })
  } catch (err) {
    console.error("[Documents] DELETE error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
