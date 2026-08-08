import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import ReferenceDoctor from "@/lib/models/ReferenceDoctor"
import Appointment from "@/lib/models/Appointment"
import { getRequestUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/reference-doctors
 *
 * Any authenticated user can list — the booking modal needs it for the
 * "Referred By" autocomplete. Each entry is enriched with `referralCount`,
 * a count of appointments whose free-text `referral` field matches the
 * reference doctor's name (case-insensitive).
 */
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  const [refs, counts] = await Promise.all([
    ReferenceDoctor.find({}).sort({ name: 1 }),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { referral: { $exists: true, $ne: "" } } },
      { $group: { _id: { $toLower: "$referral" }, count: { $sum: 1 } } },
    ]),
  ])

  const countByLowerName = new Map<string, number>()
  for (const c of counts) countByLowerName.set(c._id, c.count)

  const data = refs.map((r) => {
    const json = r.toJSON() as Record<string, unknown> & { name?: string }
    const key = String(json.name ?? "").toLowerCase()
    json.referralCount = countByLowerName.get(key) ?? 0
    return json
  })

  return NextResponse.json({ data })
}

/**
 * POST /api/reference-doctors — create a new reference doctor.
 * Admin + manager only (matches the doctor-management gate).
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await connectDB()
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const ref = await ReferenceDoctor.create({
    name,
    phone: String(body.phone ?? "").trim(),
    email: String(body.email ?? "").trim(),
    specialty: String(body.specialty ?? "").trim(),
    hospital: String(body.hospital ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
    isActive: body.isActive !== false,
  })

  return NextResponse.json({ data: ref.toJSON() }, { status: 201 })
}
