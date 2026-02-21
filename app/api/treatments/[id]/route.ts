import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Treatment from "@/lib/models/Treatment"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const treatment = await Treatment.findById(id)
  if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: treatment.toJSON() })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const body = await request.json()
  const treatment = await Treatment.findByIdAndUpdate(id, body, { new: true, runValidators: true })
  if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: treatment.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  await Treatment.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
