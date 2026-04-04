import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import PatientFile from "@/lib/models/PatientFile"
import { getRequestUser } from "@/lib/auth"

// POST /api/patients/[id]/documents  — upload a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await connectDB()

  const { filename, contentType, data: base64 } = await request.json()
  if (!filename || !contentType || !base64)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

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
  }

  const patient = await Patient.findByIdAndUpdate(
    id,
    { $push: { documents: newDoc } },
    { new: true }
  )
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

  return NextResponse.json({ data: patient.toJSON() })
}

// DELETE /api/patients/[id]/documents?docId=xxx  — remove a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const docId = new URL(request.url).searchParams.get("docId")
  if (!docId) return NextResponse.json({ error: "Missing docId" }, { status: 400 })

  await connectDB()

  await PatientFile.findByIdAndDelete(docId).catch(() => null)

  const patient = await Patient.findByIdAndUpdate(
    id,
    { $pull: { documents: { id: docId } } },
    { new: true }
  )
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

  return NextResponse.json({ data: patient.toJSON() })
}
