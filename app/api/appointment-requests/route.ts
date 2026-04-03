import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import AppointmentRequest from "@/lib/models/AppointmentRequest"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const requests = await AppointmentRequest.find({}).sort({ createdAt: -1 })
  return NextResponse.json({ data: requests.map((r) => r.toJSON()) })
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id, status } = await request.json()
  const updated = await AppointmentRequest.findByIdAndUpdate(id, { status }, { new: true })
  return NextResponse.json({ data: updated?.toJSON() })
}
