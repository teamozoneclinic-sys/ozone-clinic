import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getPKTDateString } from "@/lib/pkt"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/display/today
 *
 * PUBLIC endpoint used by the waiting-room LCD display page. Returns today's
 * appointments with the minimum PHI needed to render the queue board:
 *   - patient name (as staff would announce it in the waiting room)
 *   - scheduled time + duration
 *   - status
 *   - doctor name + specialty
 *
 * Deliberately excludes: patient phone, DOB, notes, medical history, invoice
 * amounts, treatment details. Nothing here that isn't already visible on a
 * standard clinic queue board.
 *
 * Response is small (~5-10 KB for a busy day) so polling every 15 seconds
 * from the display screen is cheap.
 */
export async function GET() {
  await connectDB()

  const today = getPKTDateString()

  const [appointments, patients, doctors, clinic] = await Promise.all([
    Appointment.find({ date: today }).sort({ time: 1 }).lean(),
    // Only fetch patient names for today's appointments (no full PHI)
    Patient.find({}).select("_id name").lean(),
    Doctor.find({}).select("_id name specialty").lean(),
    ClinicSettings.findOne({}).select("name").lean(),
  ])

  const patientById = new Map(patients.map((p) => [String(p._id), p.name]))
  const doctorById = new Map(
    doctors.map((d) => [String(d._id), { name: d.name, specialty: d.specialty }])
  )

  const rows = appointments.map((a) => {
    const doctor = doctorById.get(String(a.doctorId))
    return {
      id: String(a._id),
      time: a.time,
      duration: a.duration ?? 0,
      status: a.status,
      patientName: patientById.get(String(a.patientId)) ?? "Patient",
      doctorName: doctor?.name ?? "",
      doctorSpecialty: doctor?.specialty ?? "",
      type: a.type ?? "",
    }
  })

  return NextResponse.json(
    {
      date: today,
      clinicName: (clinic as { name?: string } | null)?.name ?? "Clinic",
      serverTime: new Date().toISOString(),
      appointments: rows,
    },
    {
      // Never cache — always fresh
      headers: { "Cache-Control": "no-store" },
    }
  )
}
