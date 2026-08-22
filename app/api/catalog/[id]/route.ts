import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import TestCatalog from "@/lib/models/TestCatalog"
import { getRequestUser } from "@/lib/auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  const body = await request.json()
  const item = await TestCatalog.findByIdAndUpdate(id, body, { returnDocument: "after" })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: item.toJSON() })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const { id } = await params
  await TestCatalog.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
