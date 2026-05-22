import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/lib/models/User"
import Doctor from "@/lib/models/Doctor"
import { getRequestUser } from "@/lib/auth"
import { toClinicEmail } from "@/lib/utils"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const users = await User.find({}).sort({ createdAt: -1 })
  return NextResponse.json({ data: users.map((u) => u.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user || user.role !== "admin")
    return NextResponse.json({ error: "Forbidden — only admin can create users" }, { status: 403 })

  try {
    await connectDB()
    const body = await request.json()

    // Every user account is forced onto the clinic email domain
    const email = toClinicEmail(body.email)
    if (!email) return NextResponse.json({ error: "A valid email is required" }, { status: 400 })

    // Check email uniqueness
    const existing = await User.findOne({ email })
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 })

    // If creating a doctor user, also create a Doctor record
    let doctorId: string | undefined
    if (body.role === "doctor") {
      const doctor = await Doctor.create({
        name: body.name,
        specialty: body.specialty || "General Medicine",
        type: body.doctorType || "full-time",
        phone: body.phone || "",
        email,
        consultationFee: body.consultationFee || 1500,
        schedule: [],
        isActive: true,
      })
      doctorId = doctor._id.toString()
    }

    const newUser = await User.create({
      name: body.name,
      email,
      password: body.password,
      role: body.role,
      doctorId,
      isActive: true,
    })

    return NextResponse.json({ data: newUser.toJSON() }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
