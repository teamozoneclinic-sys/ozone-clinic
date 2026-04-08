import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Appointment from "@/lib/models/Appointment"
import Invoice from "@/lib/models/Invoice"
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
      await invoice.save()
      console.log(`[Delete] Voided invoice ${invoice._id} for appointment ${id} — reason: ${reason}`)
    }
  }

  await Appointment.findByIdAndDelete(id)
  console.log(`[Delete] Appointment ${id} deleted by ${user.email} — reason: ${reason}`)

  return NextResponse.json({ success: true })
}
