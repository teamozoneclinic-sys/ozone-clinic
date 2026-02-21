import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/lib/models/User"
import { getRequestUser } from "@/lib/auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  const body = await request.json()

  // Don't allow password update through this route — use separate endpoint
  delete body.password

  const updated = await User.findByIdAndUpdate(id, body, { new: true })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: updated.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params

  // Prevent self-deletion
  if (id === user.id) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })

  await User.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
