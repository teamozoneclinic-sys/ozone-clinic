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

  // Send follow-up reminders: 2 days before, 1 day before, and on the day
  // Cron should run daily early morning (e.g. 7:00 AM PKT)
  const nowPKT = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const todayStr = nowPKT.toISOString().split("T")[0] // "YYYY-MM-DD"

  const addDays = (base: Date, days: number) => {
    const d = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
    return d.toISOString().split("T")[0]
  }

  const dayPlus1 = addDays(nowPKT, 1)
  const dayPlus2 = addDays(nowPKT, 2)

  // Find treatments with follow-up in: today, tomorrow, or day after tomorrow
  const treatments = await Treatment.find({
    followUpDate: { $in: [todayStr, dayPlus1, dayPlus2] },
  })

  if (treatments.length === 0) {
    return NextResponse.json({ sent: 0, message: "No follow-up reminders to send" })
  }

  const clinic = await ClinicSettings.findOne({})
  const clinicPhone = clinic?.phone || clinic?.name || "the hospital"
  let sent = 0

  for (const treatment of treatments) {
    const patient = await Patient.findById(treatment.patientId)
    if (!patient?.phone) continue

    const doctor = await Doctor.findById(treatment.doctorId)
    const doctorName = doctor?.name ?? "your doctor"

    // Determine how many days away the follow-up is
    const followUpDate: string = treatment.followUpDate ?? todayStr
    let reminderLabel = ""
    if (followUpDate === todayStr) {
      reminderLabel = "today"
    } else if (followUpDate === dayPlus1) {
      reminderLabel = "tomorrow"
    } else if (followUpDate === dayPlus2) {
      reminderLabel = "in 2 days"
    }

    // Display date as DD/MM/YYYY
    const displayDate = followUpDate.split("-").reverse().join("/")

    const params = [patient.name || "Patient", displayDate, doctorName, clinicPhone, reminderLabel]
    console.log(`[Cron] Sending followup_reminder to ${patient.phone} (${reminderLabel}) with params:`, params)

    const ok = await sendWhatsAppTemplate(
      patient.phone,
      "followup_reminder",
      params
    )
    if (ok) {
      console.log(`[WhatsApp] ✅ Follow-up reminder (${reminderLabel}) sent to ${patient.phone} (${patient.name})`)
      sent++
    }
  }

  return NextResponse.json({ sent, total: treatments.length, dates: { today: todayStr, tomorrow: dayPlus1, dayAfter: dayPlus2 } })
}
