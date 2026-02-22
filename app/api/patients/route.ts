import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = {}
  if (user.role === "doctor" && user.doctorId) {
    // Return patients assigned to this doctor OR who have any appointment with this doctor
    const apptPatientIds = await Appointment.find({ doctorId: user.doctorId }).distinct("patientId")
    query = apptPatientIds.length > 0
      ? { $or: [{ assignedDoctorId: user.doctorId }, { _id: { $in: apptPatientIds } }] }
      : { assignedDoctorId: user.doctorId }
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
