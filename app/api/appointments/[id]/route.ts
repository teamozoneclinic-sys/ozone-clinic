import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import { getRequestUser, requirePermission } from "@/lib/auth"
import { sendWhatsAppTemplate } from "@/lib/whatsapp"

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`
}

// Fire-and-forget WhatsApp cancellation. Uses the pre-approved
// "appointment_cancellation" template; body params:
//   {{1}} patient name  {{2}} doctor name  {{3}} date  {{4}} time
function notifyCancellation(appt: {
  patientId: string
  doctorId: string
  date: string
  time: string
}): void {
  Promise.all([
    Patient.findById(appt.patientId),
    appt.doctorId ? Doctor.findById(appt.doctorId) : Promise.resolve(null),
  ])
    .then(async ([patient, doctor]) => {
      if (!patient?.phone) return

      const formattedDate = new Date(appt.date).toLocaleDateString("en-PK", { dateStyle: "long" })
      const formattedTime = formatTime12h(appt.time)

      const ok = await sendWhatsAppTemplate(
        patient.phone,
        "appointment_cancellation",
        [
          patient.name || "Patient",
          doctor?.name || "Doctor",
          formattedDate,
          formattedTime,
        ]
      )
      if (ok) {
        console.log(`[WhatsApp] ✅ Cancellation sent to ${patient.phone} (${patient.name})`)
      }
    })
    .catch((err) => {
      console.error("[WhatsApp] Appointment cancellation failed:", err)
    })
}

// Fire-and-forget WhatsApp reschedule notice. Prefers a dedicated
// "appointment_rescheduled" template if approved, falls back to the
// existing "appointment_confirmation" template so delivery is guaranteed
// without any Meta setup. Params for confirmation template:
//   {{1}} patient name  {{2}} doctor name  {{3}} date  {{4}} time  {{5}} type
function notifyReschedule(appt: {
  patientId: string
  doctorId: string
  date: string
  time: string
  type: string
}): void {
  Promise.all([
    Patient.findById(appt.patientId),
    appt.doctorId ? Doctor.findById(appt.doctorId) : Promise.resolve(null),
  ])
    .then(async ([patient, doctor]) => {
      if (!patient?.phone) return

      const formattedDate = new Date(appt.date).toLocaleDateString("en-PK", { dateStyle: "long" })
      const formattedTime = formatTime12h(appt.time)
      const appointmentType = appt.type
        ? appt.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Consultation"

      const params = [
        patient.name || "Patient",
        doctor?.name || "Doctor",
        formattedDate,
        formattedTime,
        appointmentType,
      ]

      // Try the dedicated rescheduled template first (patient-friendly wording).
      let ok = await sendWhatsAppTemplate(patient.phone, "appointment_rescheduled", params)
      if (ok) {
        console.log(`[WhatsApp] ✅ Reschedule notice sent to ${patient.phone} (${patient.name})`)
        return
      }

      // Fallback — appointment_confirmation carries the same 5 params. The
      // patient sees a fresh confirmation with the new date/time, which
      // functionally communicates the reschedule until the dedicated
      // template is approved in Meta.
      ok = await sendWhatsAppTemplate(patient.phone, "appointment_confirmation", params)
      if (ok) {
        console.log(
          `[WhatsApp] ✅ Reschedule notice (via confirmation template) sent to ${patient.phone} (${patient.name})`
        )
      } else {
        console.warn(
          `[WhatsApp] ⚠ Reschedule notice failed for ${patient.phone} — both templates rejected by Meta.`
        )
      }
    })
    .catch((err) => {
      console.error("[WhatsApp] Reschedule notification failed:", err)
    })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const appointment = await Appointment.findById(id)
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: appointment.toJSON() })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await request.json()

  // A cancellation needs appointments.cancel; any other edit needs appointments.edit
  const requiredPerm = body.status === "cancelled" ? "appointments.cancel" : "appointments.edit"
  const gate = await requirePermission(request, requiredPerm)
  if ("response" in gate) return gate.response
  const { user } = gate

  // Snapshot the pre-update date/time so we can detect a genuine reschedule
  // AFTER the save (any date/time change on a non-cancelling update fires a
  // WhatsApp notice to the patient). Loaded here to avoid a second query.
  let preUpdate: { date: string; time: string } | null = null
  if (body.status !== "cancelled" && (body.date !== undefined || body.time !== undefined)) {
    const snapshot = await Appointment.findById(id).select("date time")
    if (snapshot) preUpdate = { date: snapshot.date, time: snapshot.time }
  }

  // When cancelling, void the linked invoice (paid or unpaid). For paid
  // invoices, capture the collected amount as `refundDue` so the front desk
  // sees an owed-refund row in the Refunds tab.
  if (body.status === "cancelled") {
    const existing = await Appointment.findById(id)
    if (existing && existing.invoiceId) {
      const invoice = await Invoice.findById(existing.invoiceId)
      if (invoice && invoice.status !== "voided") {
        const wasPaid = invoice.paidAmount > 0
        const priorPaid = invoice.paidAmount

        invoice.status = "voided"
        invoice.balance = 0
        invoice.voidedReason = "Appointment cancelled"
        if (wasPaid) {
          invoice.refundDue = (invoice.refundDue ?? 0) + priorPaid
        }
        await invoice.save()

        await AuditLog.create({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: "Invoice Voided",
          entity: "Invoice",
          entityId: invoice._id.toString(),
          details:
            `Invoice #${invoice._id} voided automatically — appointment cancelled.` +
            (wasPaid ? ` Refund owed to patient: Rs. ${priorPaid}.` : ""),
          timestamp: new Date().toISOString(),
        })
      }
    }

    await AuditLog.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Appointment Cancelled",
      entity: "Appointment",
      entityId: id,
      details: `Appointment cancelled by ${user.name} (${user.role}).`,
      timestamp: new Date().toISOString(),
    })
  }

  const appointment = await Appointment.findByIdAndUpdate(id, body, { new: true, runValidators: true })
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body.status === "cancelled") {
    notifyCancellation({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      date: appointment.date,
      time: appointment.time,
    })
  }

  // Reschedule notification — the date OR time actually changed, and the
  // update isn't the cancellation flow. Fires WhatsApp + writes audit log.
  if (
    preUpdate &&
    body.status !== "cancelled" &&
    appointment.status !== "cancelled" &&
    (preUpdate.date !== appointment.date || preUpdate.time !== appointment.time)
  ) {
    notifyReschedule({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      date: appointment.date,
      time: appointment.time,
      type: appointment.type,
    })

    try {
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "Appointment Rescheduled",
        entity: "Appointment",
        entityId: id,
        details:
          `Rescheduled by ${user.name} (${user.role}): ` +
          `${preUpdate.date} ${preUpdate.time} → ${appointment.date} ${appointment.time}. ` +
          `Patient notified on WhatsApp.`,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Audit failure must not block the update
    }
  }

  return NextResponse.json({ data: appointment.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only admins can delete appointments
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete appointments" }, { status: 403 })
  }

  let reason = ""
  try {
    const body = await request.json()
    reason = body?.reason ?? ""
  } catch {
    // no body
  }

  if (!reason.trim()) {
    return NextResponse.json({ error: "Deletion reason is required" }, { status: 400 })
  }

  await connectDB()
  const { id } = await params

  const appointment = await Appointment.findById(id)
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Void the invoice if it exists and hasn't been paid
  if (appointment.invoiceId) {
    const invoice = await Invoice.findById(appointment.invoiceId)
    if (invoice && invoice.status !== "paid") {
      invoice.status = "voided"
      invoice.balance = 0
      invoice.voidedReason = `Appointment deleted — ${reason}`
      await invoice.save()

      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "Invoice Voided",
        entity: "Invoice",
        entityId: invoice._id.toString(),
        details: `Invoice #${invoice._id} voided automatically — appointment deleted. Reason: ${reason}`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  await AuditLog.create({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "Appointment Deleted",
    entity: "Appointment",
    entityId: id,
    details: `Appointment permanently deleted by ${user.name} (${user.role}). Reason: ${reason}`,
    timestamp: new Date().toISOString(),
  })

  // Notify patient BEFORE deletion — use the appointment we already loaded
  notifyCancellation({
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    date: appointment.date,
    time: appointment.time,
  })

  await Appointment.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
