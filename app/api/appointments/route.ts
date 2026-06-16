import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import Doctor from "@/lib/models/Doctor"
import Patient from "@/lib/models/Patient"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser, requirePermission } from "@/lib/auth"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = {}
  // Doctors see appointments where they were the treating doctor OR for any
  // patient currently assigned to them (so a re-assigned patient's full
  // appointment history surfaces under the new doctor too).
  if (user.role === "doctor" && user.doctorId) {
    const assignedPatientIds = await Patient.find({ assignedDoctorId: user.doctorId }).distinct("_id")
    const idStrings = assignedPatientIds.map((id) => id.toString())
    query = idStrings.length > 0
      ? { $or: [{ doctorId: user.doctorId }, { patientId: { $in: idStrings } }] }
      : { doctorId: user.doctorId }
  }

  const appointments = await Appointment.find(query).sort({ date: -1, time: 1 })
  return NextResponse.json({ data: appointments.map((a) => a.toJSON()) })
}

export async function POST(request: NextRequest) {
  const gate = await requirePermission(request, "appointments.create")
  if ("response" in gate) return gate.response
  const { user } = gate

  await connectDB()
  const body = await request.json()

  // Optional billing extras — applied to the auto-created invoice, not the appointment.
  // (Unknown fields are dropped by Mongoose strict mode, so `...body` stays safe.)
  const procedures: { name: string; amount: number }[] = Array.isArray(body.procedures)
    ? body.procedures
    : []
  const discount: { description?: string; amount?: number } | null =
    body.discount && typeof body.discount === "object" ? body.discount : null

  // Create appointment
  const appointment = await Appointment.create({
    ...body,
    status: "scheduled",
    invoiceId: "",
  })

  // Auto-create invoice: consultation fee (when a doctor is set) + optional procedures + optional discount
  try {
    // Doctor is optional — only look one up when an id was supplied
    const doctor = body.doctorId ? await Doctor.findById(body.doctorId) : null

    const lineItems: {
      id: string
      description: string
      category: string
      amount: number
      quantity: number
    }[] = []

    // Consultation line — only when a doctor is assigned at booking time
    if (doctor) {
      lineItems.push({
        id: `li_${Date.now()}`,
        description: `Consultation - ${doctor.specialty}`,
        category: "consultation",
        amount: doctor.consultationFee,
        quantity: 1,
      })
    }

    // Optional procedure line items (catalog-selected or custom)
    procedures.forEach((p, i) => {
      const amount = Number(p?.amount)
      if (p?.name && Number.isFinite(amount) && amount > 0) {
        lineItems.push({
          id: `li_proc_${Date.now()}_${i}`,
          description: String(p.name).trim(),
          category: "procedure",
          amount,
          quantity: 1,
        })
      }
    })

    // Optional discount — only admin & manager may apply one
    const discountAmount = Number(discount?.amount)
    const discountApplied =
      !!discount &&
      Number.isFinite(discountAmount) &&
      discountAmount > 0 &&
      ["admin", "manager", "receptionist"].includes(user.role)
    if (discountApplied) {
      lineItems.push({
        id: `li_disc_${Date.now()}`,
        description: `Discount: ${discount!.description?.trim() || "Discount"} (by ${user.name})`,
        category: "discount",
        amount: -Math.abs(discountAmount),
        quantity: 1,
      })
    }

    // Create the invoice whenever there is something to bill — a doctor's
    // consultation, a procedure, or a discount. A procedure-only booking with
    // no doctor still gets an invoice; the consultation line is added later
    // when a doctor is assigned.
    if (lineItems.length > 0) {
      const totalAmount = Math.max(
        0,
        lineItems.reduce((sum, li) => sum + li.amount * li.quantity, 0)
      )

      const invoice = await Invoice.create({
        patientId: body.patientId,
        appointmentId: appointment._id.toString(),
        doctorId: body.doctorId || "",
        lineItems,
        totalAmount,
        paidAmount: 0,
        balance: totalAmount,
        status: "unpaid",
        payments: [],
      })
      // Link invoice back to appointment
      await Appointment.findByIdAndUpdate(appointment._id, { invoiceId: invoice._id.toString() })
      appointment.invoiceId = invoice._id.toString()

      // Audit the discount — sensitive financial action
      if (discountApplied) {
        try {
          await AuditLog.create({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: "Discount Applied",
            entity: "Invoice",
            entityId: invoice._id.toString(),
            details: `Discount of Rs. ${Math.abs(discountAmount)} applied at booking. Reason: ${discount!.description?.trim() || "Discount"}.`,
            timestamp: new Date().toISOString(),
          })
        } catch {
          // Audit failure must not block booking
        }
      }
    }
  } catch {
    // Invoice creation failure is non-fatal
  }

  // Send WhatsApp appointment confirmation — non-blocking
  Promise.all([
    Patient.findById(body.patientId),
    body.doctorId ? Doctor.findById(body.doctorId) : Promise.resolve(null),
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
