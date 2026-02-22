import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import AuditLog from "@/lib/models/AuditLog"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const entries = await AuditLog.find({}).sort({ timestamp: -1 }).limit(500)
  return NextResponse.json({ data: entries.map((e) => e.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await connectDB()
    const body = await request.json()
    const entry = await AuditLog.create({
      ...body,
      timestamp: body.timestamp ?? new Date().toISOString(),
    })
    return NextResponse.json({ data: entry.toJSON() }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to log audit entry"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
