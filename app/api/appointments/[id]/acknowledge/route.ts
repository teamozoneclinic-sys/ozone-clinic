import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

/**
 * Acknowledge a WhatsApp-bot booking — records that a staff member has seen it
 * and writes an audit-log entry. Idempotent: the first acknowledgement wins.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params

  const appointment = await Appointment.findById(id)
  if (!appointment) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })

  if (!appointment.whatsappAcknowledgedBy) {
    appointment.whatsappAcknowledgedBy = user.name
    appointment.whatsappAcknowledgedAt = new Date().toISOString()
    await appointment.save()

    try {
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "WhatsApp Booking Acknowledged",
        entity: "Appointment",
        entityId: id,
        details: `${user.name} (${user.role}) acknowledged the WhatsApp booking.`,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Audit failure must not block the acknowledgement
    }
  }

  return NextResponse.json({ data: appointment.toJSON() })
}
