import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {}
  if (user.role === "doctor" && user.doctorId) {
    query.doctorId = user.doctorId
  }

  // Delta-sync support — see /api/patients for the pattern.
  // Backward-compatible: without ?since= we return everything, as before.
  const sinceParam = request.nextUrl.searchParams.get("since")
  const sinceDate = sinceParam ? new Date(sinceParam) : null
  if (sinceDate && !isNaN(sinceDate.getTime())) {
    query.updatedAt = { $gt: sinceDate }
  }

  const invoices = await Invoice.find(query).sort({ createdAt: -1 })

  return NextResponse.json({
    data: invoices.map((i) => i.toJSON()),
    serverTime: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const body = await request.json()
  const invoice = await Invoice.create(body)
  return NextResponse.json({ data: invoice.toJSON() }, { status: 201 })
}
