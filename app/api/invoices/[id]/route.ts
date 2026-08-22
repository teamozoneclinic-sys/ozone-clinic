import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Invoice from "@/lib/models/Invoice"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const invoice = await Invoice.findById(id)
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: invoice.toJSON() })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const { id } = await params
  const body = await request.json()
  const invoice = await Invoice.findByIdAndUpdate(id, body, { returnDocument: "after", runValidators: true })
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: invoice.toJSON() })
}
