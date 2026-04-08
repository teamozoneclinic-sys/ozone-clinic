import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

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
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const body = await request.json()

  // When cancelling, void any unpaid invoice and write audit logs
  if (body.status === "cancelled") {
    const existing = await Appointment.findById(id)
    if (existing && existing.invoiceId) {
      const invoice = await Invoice.findById(existing.invoiceId)
      if (invoice && invoice.status !== "paid") {
        invoice.status = "voided"
        invoice.balance = 0
        invoice.voidedReason = "Appointment cancelled"
        await invoice.save()

        await AuditLog.create({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: "Invoice Voided",
          entity: "Invoice",
          entityId: invoice._id.toString(),
          details: `Invoice #${invoice._id} voided automatically — appointment cancelled.`,
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

  await Appointment.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
