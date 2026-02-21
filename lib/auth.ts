import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "clinic-erp-fallback-secret"
)

export interface JWTPayload {
  id: string
  name: string
  email: string
  role: string
  doctorId?: string
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secret)
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JWTPayload
}

/** Read + verify the auth cookie from a server component / route handler */
export async function getServerUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) return null
    return await verifyJWT(token)
  } catch {
    return null
  }
}

/** Read + verify the auth cookie from a Next.js Route Handler Request */
export async function getRequestUser(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null
    return await verifyJWT(token)
  } catch {
    return null
  }
}
