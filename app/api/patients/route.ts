import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"

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

  // Send WhatsApp welcome message using approved template (non-blocking)
  if (patient.phone) {
    const clinic = await ClinicSettings.findOne({})
    const patientRef = patient._id.toString().slice(-8).toUpperCase()
    const regDate = new Date().toLocaleDateString("en-PK", { dateStyle: "long" })
    const contactInfo = clinic?.phone ?? clinic?.email ?? "the hospital"

    sendWhatsAppTemplate(patient.phone, "welcome_patient", [
      patient.name,
      patientRef,
      regDate,
      contactInfo,
    ]).then((ok) => {
      if (ok) console.log(`[WhatsApp] ✅ Welcome message sent to ${patient.phone} (${patient.name})`)
    }).catch((err) => {
      console.error("[WhatsApp] Welcome message failed:", err)
    })
  }

  return NextResponse.json({ data: patient.toJSON() }, { status: 201 })
}
