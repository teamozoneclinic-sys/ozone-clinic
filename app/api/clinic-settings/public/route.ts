import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import ClinicSettings from "@/lib/models/ClinicSettings"

export const dynamic = "force-dynamic"

// Public endpoint — no auth required — returns only the clinic name for the login page
export async function GET() {
  try {
    await connectDB()
    const settings = await ClinicSettings.findOne({})
    const res = NextResponse.json({ name: settings?.name ?? "HealthCare Clinic", logo: settings?.logo ?? "" })
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    return res
  } catch {
    return NextResponse.json({ name: "HealthCare Clinic", logo: "" })
  }
}
