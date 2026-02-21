import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Patient from "@/lib/models/Patient"
import { getRequestUser } from "@/lib/auth"

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
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const body = await request.json()
  const patient = await Patient.findByIdAndUpdate(id, body, { new: true, runValidators: true })
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: patient.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  await Patient.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
