import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"
import ClinicSettings from "@/lib/models/ClinicSettings"

export const dynamic = "force-dynamic"
// Hobby plan default function timeout is 10s, max is 60s. Patient loops with
// Meta API calls regularly need >10s for any non-trivial number of reminders.
export const maxDuration = 60

/**
 * Follow-up reminder cron.
 *
 * Triggered by Vercel Cron at two scheduled times (see vercel.json):
 *   - 12:00 UTC ≈ 5:00 PM PKT  with ?window=day-before → reminds patients
 *     whose follow-up is tomorrow.
 *   - 09:00 UTC ≈ 2:00 PM PKT  with ?window=day-of    → reminds patients
 *     whose follow-up is today.
 *
 * IMPORTANT — Vercel Hobby plan quirks (see Vercel dashboard screenshot):
 *   1. **Flexible 1-hour window**: cron fires *somewhere* inside the hour,
 *      not at the exact minute. "5 PM PKT" really means "any time
 *      5:00–5:59 PM PKT". This is by design, not a bug — upgrade to Pro for
 *      exact-minute precision.
 *   2. **Daily-only**: schedules must be daily on Hobby (no hourly/minutely).
 *   3. **10s default timeout**: bumped to 60s via `maxDuration` above so a
 *      backlog of reminders can complete.
 *
 * Auth: Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}`
 * to the request. The CRON_SECRET env var **must be set** in Vercel project
 * settings — if it's missing OR mismatched, every cron call returns 401 and
 * NO reminders go out. This is the single most common reason "cron isn't
 * working" on a freshly deployed project.
 *
 * Manual test: use the **Run** button in Vercel → Settings → Cron Jobs.
 * Vercel will fire the route with the correct Bearer token attached.
 */
export async function GET(request: NextRequest) {
  // Protect the cron endpoint
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(
      "[Cron] 401 — authorization header missing or mismatched. " +
        "Check that CRON_SECRET env var is set in Vercel project settings."
    )
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
  // - "day-before" → followUpDate = tomorrow (reminder fires today ~5 PM)
  // - "day-of"     → followUpDate = today    (reminder fires today ~2 PM)
  const targetDate =
    windowParam === "day-before"
      ? new Date(nowPKT.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : todayStr

  const reminderLabel = windowParam === "day-before" ? "tomorrow" : "today"

  console.log(
    `[Cron/${windowParam}] Running at ${nowPKT.toISOString()} (PKT). ` +
      `Looking for treatments with followUpDate = ${targetDate}.`
  )

  const treatments = await Treatment.find({ followUpDate: targetDate })

  if (treatments.length === 0) {
    console.log(`[Cron/${windowParam}] 0 treatments match — nothing to send.`)
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
  const displayDate = targetDate.split("-").reverse().join("/") // DD/MM/YYYY

  // Fan out the Meta API calls in parallel — sequential await was a real
  // problem on Hobby's 10s default timeout. Promise.allSettled so a single
  // failure (e.g. bad phone number) never blocks the rest.
  const sendOps = treatments.map(async (treatment) => {
    const patient = await Patient.findById(treatment.patientId)
    if (!patient?.phone) {
      return { ok: false, reason: `Treatment ${treatment._id}: patient missing phone` }
    }

    const doctor = await Doctor.findById(treatment.doctorId)
    const doctorName = doctor?.name ?? "your doctor"

    const params = [
      patient.name || "Patient",
      displayDate,
      doctorName,
      clinicPhone,
      reminderLabel,
    ]

    try {
      const ok = await sendWhatsAppTemplate(patient.phone, "followup_reminder", params)
      if (ok) {
        console.log(
          `[WhatsApp] ✅ Follow-up (${reminderLabel}) sent to ${patient.phone} (${patient.name})`
        )
        return { ok: true as const }
      }
      return { ok: false as const, reason: `${patient.phone}: Meta returned non-OK` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error"
      return { ok: false as const, reason: `${patient.phone}: ${msg}` }
    }
  })

  const results = await Promise.allSettled(sendOps)
  let sent = 0
  const failures: string[] = []
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      sent++
    } else if (r.status === "fulfilled" && !r.value.ok) {
      failures.push(r.value.reason)
    } else if (r.status === "rejected") {
      failures.push(r.reason instanceof Error ? r.reason.message : String(r.reason))
    }
  }

  console.log(
    `[Cron/${windowParam}] Finished — sent ${sent}/${treatments.length}` +
      (failures.length > 0 ? `, ${failures.length} failure(s)` : "")
  )

  return NextResponse.json({
    window: windowParam,
    targetDate,
    sent,
    total: treatments.length,
    failures: failures.length > 0 ? failures : undefined,
  })
}
