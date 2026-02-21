import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import TestCatalog from "@/lib/models/TestCatalog"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const items = await TestCatalog.find({}).sort({ category: 1, name: 1 })
  return NextResponse.json({ data: items.map((i) => i.toJSON()) })
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const body = await request.json()
  const item = await TestCatalog.create(body)
  return NextResponse.json({ data: item.toJSON() }, { status: 201 })
}
