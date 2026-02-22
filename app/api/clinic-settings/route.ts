import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import ClinicSettings from "@/lib/models/ClinicSettings"
import { getRequestUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  // There is exactly one settings document — upsert on first access
  let settings = await ClinicSettings.findOne({})
  if (!settings) {
    settings = await ClinicSettings.create({})
  }
  return NextResponse.json({ data: settings.toJSON() })
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user || !["admin", "manager"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    await connectDB()
    const body = await request.json()

    let settings = await ClinicSettings.findOne({})
    if (!settings) {
      settings = await ClinicSettings.create(body)
    } else {
      Object.assign(settings, body)
      await settings.save()
    }
    return NextResponse.json({ data: settings.toJSON() })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save clinic settings"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
