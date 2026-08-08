import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import ReferenceDoctor from "@/lib/models/ReferenceDoctor"
import { getRequestUser } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const ref = await ReferenceDoctor.findById(id)
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: ref.toJSON() })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await connectDB()
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Whitelist the updatable fields — no accidental writes to createdAt etc.
  const update: Record<string, unknown> = {}
  if (typeof body.name === "string") update.name = body.name.trim()
  if (typeof body.phone === "string") update.phone = body.phone.trim()
  if (typeof body.email === "string") update.email = body.email.trim()
  if (typeof body.specialty === "string") update.specialty = body.specialty.trim()
  if (typeof body.hospital === "string") update.hospital = body.hospital.trim()
  if (typeof body.notes === "string") update.notes = body.notes.trim()
  if (typeof body.isActive === "boolean") update.isActive = body.isActive

  if (update.name === "") {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
  }

  const ref = await ReferenceDoctor.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  })
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: ref.toJSON() })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await connectDB()
  const { id } = await params
  const ref = await ReferenceDoctor.findByIdAndDelete(id)
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
