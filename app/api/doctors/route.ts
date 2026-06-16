import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Doctor from "@/lib/models/Doctor"
import User from "@/lib/models/User"
import { getRequestUser, requirePermission } from "@/lib/auth"
import { CLINIC_EMAIL_DOMAIN, toClinicEmail } from "@/lib/utils"

// Derive email + password from a doctor's name
// e.g. "Dr. Ahmed Khan" → email: "dr.ahmedkhan@ozoneclinic.com", password: "ahmedkhan123"
function deriveCredentials(name: string) {
  const stripped = name.replace(/^dr\.?\s*/i, "").trim()
  const slug = stripped.toLowerCase().replace(/\s+/g, "")
  return {
    email: `dr.${slug}@${CLINIC_EMAIL_DOMAIN}`,
    password: `${slug}123`,
  }
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const doctors = await Doctor.find({}).sort({ name: 1 })
  return NextResponse.json({ data: doctors.map((d) => d.toJSON()) })
}

export async function POST(request: NextRequest) {
  // Matrix: doctors.create is admin-only (manager has doctors.view only)
  const gate = await requirePermission(request, "doctors.create")
  if ("response" in gate) return gate.response

  try {
    await connectDB()
    const body = await request.json()
    // Force every doctor email onto the clinic domain — defence in depth
    // against direct API calls that bypass the client-side check.
    if (body.email) body.email = toClinicEmail(body.email)
    const doctor = await Doctor.create(body)

    // Auto-create login credentials for the new doctor
    try {
      const { email, password } = deriveCredentials(body.name ?? "")
      // Check if a user with that email already exists
      const existing = await User.findOne({ email })
      if (!existing) {
        await User.create({
          name: body.name,
          email,
          password,
          role: "doctor",
          doctorId: doctor._id.toString(),
          isActive: true,
        })
      }
    } catch (credErr) {
      // Credential creation failing should not block doctor creation
      console.error("Failed to auto-create doctor credentials:", credErr)
    }

    return NextResponse.json({ data: doctor.toJSON() }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create doctor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
