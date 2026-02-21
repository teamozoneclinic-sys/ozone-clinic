import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  let query = {}
  // Doctors only see their own patients
  if (user.role === "doctor" && user.doctorId) {
    query = { assignedDoctorId: user.doctorId }
  }

  const patients = await Patient.find(query).sort({ createdAt: -1 })
  return NextResponse.json({ data: patients.map((p) => p.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const body = await request.json()
  const patient = await Patient.create(body)
  return NextResponse.json({ data: patient.toJSON() }, { status: 201 })
}
