import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import Appointment from "@/lib/models/Appointment"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser, requirePermission } from "@/lib/auth"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {}
  if (user.role === "doctor" && user.doctorId) {
    // Return patients assigned to this doctor OR who have any appointment with this doctor
    const apptPatientIds = await Appointment.find({ doctorId: user.doctorId }).distinct("patientId")
    if (apptPatientIds.length > 0) {
      query.$or = [{ assignedDoctorId: user.doctorId }, { _id: { $in: apptPatientIds } }]
    } else {
      query.assignedDoctorId = user.doctorId
    }
  }

  // Delta-sync support — when the client passes ?since=<iso>, return only
  // records whose updatedAt is newer, plus a fresh serverTime for the next
  // poll's `since` cursor. Backward-compatible: without ?since= we return
  // the full list exactly as before.
  const sinceParam = request.nextUrl.searchParams.get("since")
  const sinceDate = sinceParam ? new Date(sinceParam) : null
  if (sinceDate && !isNaN(sinceDate.getTime())) {
    query.updatedAt = { $gt: sinceDate }
  }

  // Strip the heavy sub-arrays from the list — they can be large and aren't
  // shown on the patients table. The patient detail page fetches the full
  // record (with documents + medicalHistory) via /api/patients/[id].
  const patients = await Patient.find(query)
    .select("-medicalHistory -documents")
    .sort({ createdAt: -1 })

  return NextResponse.json({
    data: patients.map((p) => p.toJSON()),
    serverTime: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  const gate = await requirePermission(request, "patients.create")
  if ("response" in gate) return gate.response

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
      patient.name || "Patient",
      patientRef,
      regDate,
      contactInfo || "the hospital",
    ], "en_US").then((ok) => {
      if (ok) console.log(`[WhatsApp] ✅ Welcome message sent to ${patient.phone} (${patient.name})`)
    }).catch((err) => {
      console.error("[WhatsApp] Welcome message failed:", err)
    })
  }

  return NextResponse.json({ data: patient.toJSON() }, { status: 201 })
}
