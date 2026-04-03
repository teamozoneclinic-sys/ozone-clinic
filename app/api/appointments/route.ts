import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import Doctor from "@/lib/models/Doctor"
import Patient from "@/lib/models/Patient"
import { getRequestUser } from "@/lib/auth"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  let query = {}
  // Doctors only see their own appointments
  if (user.role === "doctor" && user.doctorId) {
    query = { doctorId: user.doctorId }
  }

  const appointments = await Appointment.find(query).sort({ date: -1, time: 1 })
  return NextResponse.json({ data: appointments.map((a) => a.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const body = await request.json()

  // Create appointment
  const appointment = await Appointment.create({
    ...body,
    status: "scheduled",
    invoiceId: "",
  })

  // Auto-create invoice using doctor's consultation fee
  try {
    const doctor = await Doctor.findById(body.doctorId)
    if (doctor) {
      const invoice = await Invoice.create({
        patientId: body.patientId,
        appointmentId: appointment._id.toString(),
        doctorId: body.doctorId,
        lineItems: [
          {
            id: `li_${Date.now()}`,
            description: `Consultation - ${doctor.specialty}`,
            category: "consultation",
            amount: doctor.consultationFee,
            quantity: 1,
          },
        ],
        totalAmount: doctor.consultationFee,
        paidAmount: 0,
        balance: doctor.consultationFee,
        status: "unpaid",
        payments: [],
      })
      // Link invoice back to appointment
      await Appointment.findByIdAndUpdate(appointment._id, { invoiceId: invoice._id.toString() })
      appointment.invoiceId = invoice._id.toString()
    }
  } catch {
    // Invoice creation failure is non-fatal
  }

  // Send WhatsApp appointment confirmation — non-blocking
  Promise.all([
    Patient.findById(body.patientId),
    Doctor.findById(body.doctorId),
  ]).then(async ([patient, doctor]) => {
    if (!patient?.phone) return

    const formattedDate = new Date(body.date).toLocaleDateString("en-PK", { dateStyle: "long" })
    const formattedTime = formatTime12h(body.time)
    const appointmentType = body.type
      ? body.type.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Consultation"

    const ok = await sendWhatsAppTemplate(
      patient.phone,
      "appointment_confirmation",
      [
        patient.name || "Patient",
        doctor?.name || "Doctor",
        formattedDate,
        formattedTime,
        appointmentType,
      ]
    )
    if (ok) {
      console.log(`[WhatsApp] ✅ Appointment confirmation sent to ${patient.phone} (${patient.name})`)
    }
  }).catch((err) => {
    console.error("[WhatsApp] Appointment confirmation failed:", err)
  })

  return NextResponse.json({ data: appointment.toJSON() }, { status: 201 })
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`
}
