import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"
import ClinicSettings from "@/lib/models/ClinicSettings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Protect the cron endpoint
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectDB()

  // Find treatments with followUpDate = tomorrow (PKT = UTC+5)
  // Cron runs at 12:00 AM PKT — we remind patients 1 day before their follow-up
  const nowPKT = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const tomorrowPKT = new Date(nowPKT.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowStr = tomorrowPKT.toISOString().split("T")[0] // "YYYY-MM-DD"

  const treatments = await Treatment.find({ followUpDate: tomorrowStr })

  if (treatments.length === 0) {
    return NextResponse.json({ sent: 0, message: "No follow-ups today" })
  }

  const clinic = await ClinicSettings.findOne({})
  const clinicPhone = clinic?.phone ?? "the hospital"
  let sent = 0

  for (const treatment of treatments) {
    const patient = await Patient.findById(treatment.patientId)
    if (!patient?.phone) continue

    const doctor = await Doctor.findById(treatment.doctorId)
    const doctorName = doctor?.name ?? "your doctor"

    const params = [patient.name || "Patient", tomorrowStr, doctorName, clinicPhone]
    console.log(`[Cron] Sending followup_reminder to ${patient.phone} with params:`, params)

    const ok = await sendWhatsAppTemplate(
      patient.phone,
      "followup_reminder",
      params
    )
    if (ok) {
      console.log(`[WhatsApp] ✅ Follow-up reminder sent to ${patient.phone} (${patient.name})`)
      sent++
    }
  }

  return NextResponse.json({ sent, total: treatments.length })
}
