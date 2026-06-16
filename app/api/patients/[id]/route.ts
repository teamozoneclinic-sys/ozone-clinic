import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import Doctor from "@/lib/models/Doctor"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser, requirePermission } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const patient = await Patient.findById(id)
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: patient.toJSON() })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission(request, "patients.edit")
  if ("response" in gate) return gate.response
  const { user } = gate

  await connectDB()
  const { id } = await params
  const body = await request.json()

  // Detect reassignment so we can write an audit log AFTER the save.
  let reassignment: { fromId: string; toId: string } | null = null
  if (Object.prototype.hasOwnProperty.call(body, "assignedDoctorId")) {
    const before = await Patient.findById(id).select("assignedDoctorId")
    const fromId = before?.assignedDoctorId || ""
    const toId = body.assignedDoctorId || ""
    if (fromId !== toId) reassignment = { fromId, toId }
  }

  const patient = await Patient.findByIdAndUpdate(id, body, { new: true, runValidators: true })
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (reassignment) {
    try {
      const [from, to] = await Promise.all([
        reassignment.fromId ? Doctor.findById(reassignment.fromId).select("name") : Promise.resolve(null),
        reassignment.toId ? Doctor.findById(reassignment.toId).select("name") : Promise.resolve(null),
      ])
      await AuditLog.create({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "Patient Reassigned",
        entity: "Patient",
        entityId: id,
        details:
          `Assigned doctor changed from ${from?.name || "(unassigned)"} to ${to?.name || "(unassigned)"}. ` +
          `All prior appointments, treatments and invoices remain linked to their original doctor.`,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Audit failure must not block the save
    }
  }

  return NextResponse.json({ data: patient.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission(request, "patients.delete")
  if ("response" in gate) return gate.response

  await connectDB()
  const { id } = await params
  await Patient.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
