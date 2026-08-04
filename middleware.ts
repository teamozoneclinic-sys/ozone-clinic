import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/seed", "/api/temp-file", "/api/cron", "/api/whatsapp/webhook", "/privacy-policy", "/display", "/api/display"]

/**
 * Verify a HS256 JWT using the Web Crypto API (Edge Runtime safe, no external deps).
 */
async function verifyJWT(token: string): Promise<boolean> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false

    const secret = process.env.JWT_SECRET || "clinic-erp-fallback-secret"
    const encoder = new TextEncoder()

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )

    // Base64url → Uint8Array
    const b64ToUint8 = (b64url: string) => {
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
      const binary = atob(b64)
      return Uint8Array.from(binary, (c) => c.charCodeAt(0))
    }

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64ToUint8(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    )

    if (!valid) return false

    // Check expiry from payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false

    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static assets and public paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get("auth_token")?.value

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const valid = await verifyJWT(token)

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL("/login", request.url))
    response.cookies.set("auth_token", "", { maxAge: 0, path: "/" })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)"],
}
