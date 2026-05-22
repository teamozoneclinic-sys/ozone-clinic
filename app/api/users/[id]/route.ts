import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/lib/models/User"
import { getRequestUser } from "@/lib/auth"
import { toClinicEmail } from "@/lib/utils"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    const target = await User.findById(id)
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (body.name) target.name = body.name.trim()
    if (body.email) {
      // Every user account is forced onto the clinic email domain
      const normalized = toClinicEmail(body.email)
      if (!normalized) return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
      target.email = normalized
    }
    // Allow password update — pre-save hook will hash it
    if (body.password && body.password.length >= 6) {
      target.password = body.password
    }

    await target.save()
    return NextResponse.json({ data: target.toJSON() })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
