import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Patient from "@/lib/models/Patient"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  let query = {}
  // Doctors only see their own treatments
  if (user.role === "doctor" && user.doctorId) {
    query = { doctorId: user.doctorId }
  }

  const treatments = await Treatment.find(query).sort({ createdAt: -1 })
  return NextResponse.json({ data: treatments.map((t) => t.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const body = await request.json()
  const treatment = await Treatment.create(body)

  // Append a medical history entry to the patient record
  const historyEntry = {
    id: treatment._id.toString(),
    date: body.date,
    type: "Visit",
    description: `Diagnosis: ${body.diagnosis}${body.complaint ? `. Complaint: ${body.complaint}` : ""}`,
    addedBy: user.name,
  }
  await Patient.findByIdAndUpdate(body.patientId, {
    $push: { medicalHistory: historyEntry },
  })

  return NextResponse.json({ data: treatment.toJSON() }, { status: 201 })
}
