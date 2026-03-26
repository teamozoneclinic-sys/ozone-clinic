import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import TempFile from "@/lib/models/TempFile"

export const dynamic = "force-dynamic"

// Public endpoint — no auth — Meta Cloud API fetches this URL to download the PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()

  const file = await TempFile.findById(id)
  if (!file) return new NextResponse(null, { status: 404 })

  return new NextResponse(file.data, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
