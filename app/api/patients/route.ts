import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsApp } from "@/lib/whatsapp"

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

  // Send WhatsApp welcome message (non-blocking)
  if (patient.phone) {
    const clinic = await ClinicSettings.findOne({})
    const clinicName = clinic?.name ?? "the Clinic"
    const regDate = new Date().toLocaleDateString("en-PK", { dateStyle: "long" })
    const divider = "━━━━━━━━━━━━━━━━━━━━━"

    const details = [
      `• 👤 *Name:* ${patient.name}`,
      `• 📞 *Phone:* ${patient.phone}`,
      patient.dateOfBirth ? `• 🎂 *Date of Birth:* ${patient.dateOfBirth}` : "",
      patient.bloodGroup   ? `• 🩸 *Blood Group:* ${patient.bloodGroup}` : "",
      patient.address      ? `• 📍 *Address:* ${patient.address}` : "",
      `• 📅 *Registered On:* ${regDate}`,
    ].filter(Boolean).join("\n")

    const contact = [
      clinic?.phone   ? `📞 ${clinic.phone}` : "",
      clinic?.address ? `📍 ${clinic.address}` : "",
      clinic?.email   ? `✉️ ${clinic.email}` : "",
    ].filter(Boolean).join("\n")

    const msg =
      `🌟 *Welcome to ${clinicName}!* 🏥\n\n` +
      `Dear *${patient.name}*, you have been successfully registered in our system.\n\n` +
      `${divider}\n` +
      `📋 *Your Registration Details:*\n` +
      `${details}\n` +
      `${divider}\n\n` +
      `You are now part of the *${clinicName}* family! We are committed to providing you with the best healthcare experience.\n\n` +
      (contact ? `*Contact Us:*\n${contact}\n\n` : "") +
      `_Stay healthy and take care!_ 💚`

    sendWhatsApp(patient.phone, msg).catch(() => {})
  }

  return NextResponse.json({ data: patient.toJSON() }, { status: 201 })
}
