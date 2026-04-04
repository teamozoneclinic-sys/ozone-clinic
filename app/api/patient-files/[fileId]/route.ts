import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import PatientFile from "@/lib/models/PatientFile"
import { getRequestUser } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fileId } = await params
  await connectDB()

  const file = await PatientFile.findById(fileId)
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const disposition = request.nextUrl.searchParams.get("download") === "1"
    ? `attachment; filename="${file.filename}"`
    : `inline; filename="${file.filename}"`

  return new NextResponse(file.data, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
