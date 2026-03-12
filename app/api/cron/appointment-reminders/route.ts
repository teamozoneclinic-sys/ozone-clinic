import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import { sendWhatsApp } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Protect the cron endpoint
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectDB()

  // Find all treatments with followUpDate = tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0] // "YYYY-MM-DD"

  const treatments = await Treatment.find({ followUpDate: tomorrowStr })

  if (treatments.length === 0) {
    return NextResponse.json({ sent: 0, message: "No follow-ups tomorrow" })
  }

  const clinicName = process.env.CLINIC_NAME ?? "the Clinic"
  let sent = 0

  for (const treatment of treatments) {
    const patient = await Patient.findById(treatment.patientId)
    if (!patient?.phone) continue

    const doctor = await Doctor.findById(treatment.doctorId)
    const doctorName = doctor?.name ?? "your doctor"

    const message =
      `📅 *Appointment Reminder*\n` +
      `${clinicName}\n\n` +
      `Dear ${patient.name},\n\n` +
      `This is a friendly reminder that you have a *follow-up appointment tomorrow* (${tomorrowStr}).\n\n` +
      `👨‍⚕️ *Doctor:* ${doctorName}\n` +
      `📋 *Diagnosis:* ${treatment.diagnosis || "Follow-up visit"}\n\n` +
      `Please arrive 10 minutes early.\n` +
      `If you need to reschedule, please contact us as soon as possible.\n\n` +
      `We look forward to seeing you! 🏥`

    const ok = await sendWhatsApp(patient.phone, message)
    if (ok) sent++
  }

  return NextResponse.json({ sent, total: treatments.length })
}
