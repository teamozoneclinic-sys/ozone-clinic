import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Doctor from "@/lib/models/Doctor"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser, requirePermission } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const doctor = await Doctor.findById(id)
  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: doctor.toJSON() })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Matrix: doctors.edit is admin-only
  const gate = await requirePermission(request, "doctors.edit")
  if ("response" in gate) return gate.response

  await connectDB()
  const { id } = await params
  const body = await request.json()
  const doctor = await Doctor.findByIdAndUpdate(id, body, { new: true, runValidators: true })
  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: doctor.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  const doctor = await Doctor.findById(id)
  if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await Doctor.findByIdAndDelete(id)

  // Audit log — all patient records linked to this doctor are preserved
  await AuditLog.create({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "Doctor Deleted",
    entity: "Doctor",
    entityId: id,
    details: `Dr. ${doctor.name} (${doctor.specialty}) removed from system. All linked patient records, appointments, treatments, and invoices are preserved.`,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
}
