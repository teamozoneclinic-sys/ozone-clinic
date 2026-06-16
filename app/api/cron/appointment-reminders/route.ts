import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"
import ClinicSettings from "@/lib/models/ClinicSettings"

export const dynamic = "force-dynamic"

/**
 * Follow-up reminder cron.
 *
 * Called by Vercel Cron at two scheduled times (see vercel.json):
 *   - 12:00 UTC (= 5:00 PM PKT) with ?window=day-before → reminds patients
 *     whose follow-up is tomorrow.
 *   - 09:00 UTC (= 2:00 PM PKT) with ?window=day-of    → reminds patients
 *     whose follow-up is today.
 *
 * The follow-up date is the `followUpDate` field on a Treatment, set by the
 * doctor at the end of an encounter via the calendar picker.
 *
 * Auth: requires the CRON_SECRET bearer token (Vercel cron auto-attaches it).
 */
export async function GET(request: NextRequest) {
  // Protect the cron endpoint
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Default to day-before so an accidental call without the param still does
  // something sane rather than silently no-op'ing.
  const windowParam = request.nextUrl.searchParams.get("window") ?? "day-before"
  if (windowParam !== "day-before" && windowParam !== "day-of") {
    return NextResponse.json(
      { error: 'Invalid window. Use "day-before" or "day-of".' },
      { status: 400 }
    )
  }

  await connectDB()

  // Compute today's date in PKT (UTC+5)
  const nowPKT = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const todayStr = nowPKT.toISOString().split("T")[0] // YYYY-MM-DD

  // Pick the target follow-up date based on the window
  // - "day-before" → followUpDate = tomorrow (reminder fires today at 5 PM)
  // - "day-of"     → followUpDate = today    (reminder fires today at 2 PM)
  const targetDate =
    windowParam === "day-before"
      ? new Date(nowPKT.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : todayStr

  const reminderLabel = windowParam === "day-before" ? "tomorrow" : "today"

  const treatments = await Treatment.find({ followUpDate: targetDate })

  if (treatments.length === 0) {
    return NextResponse.json({
      window: windowParam,
      targetDate,
      sent: 0,
      total: 0,
      message: "No follow-ups due in this window",
    })
  }

  const clinic = await ClinicSettings.findOne({})
  const clinicPhone = clinic?.phone || clinic?.name || "the hospital"
  let sent = 0
  const failures: string[] = []

  for (const treatment of treatments) {
    const patient = await Patient.findById(treatment.patientId)
    if (!patient?.phone) {
      failures.push(`Treatment ${treatment._id}: patient missing phone`)
      continue
    }

    const doctor = await Doctor.findById(treatment.doctorId)
    const doctorName = doctor?.name ?? "your doctor"

    // Display date as DD/MM/YYYY for the patient-facing message
    const displayDate = targetDate.split("-").reverse().join("/")

    const params = [
      patient.name || "Patient",
      displayDate,
      doctorName,
      clinicPhone,
      reminderLabel,
    ]
    console.log(
      `[Cron/${windowParam}] Sending followup_reminder to ${patient.phone} ` +
        `(${reminderLabel}) — params:`,
      params
    )

    try {
      const ok = await sendWhatsAppTemplate(patient.phone, "followup_reminder", params)
      if (ok) {
        console.log(
          `[WhatsApp] ✅ Follow-up (${reminderLabel}) sent to ${patient.phone} (${patient.name})`
        )
        sent++
      } else {
        failures.push(`${patient.phone}: send returned false`)
      }
    } catch (err) {
      failures.push(`${patient.phone}: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }

  return NextResponse.json({
    window: windowParam,
    targetDate,
    sent,
    total: treatments.length,
    failures: failures.length > 0 ? failures : undefined,
  })
}
