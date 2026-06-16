import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { ROLE_PERMISSIONS } from "./constants"
import type { Permission } from "./types"

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

/** Single source of truth for role→permission resolution (mirrors store.tsx). */
export function userHasPermission(user: JWTPayload | null, permission: Permission): boolean {
  if (!user) return false
  const rolePerm = ROLE_PERMISSIONS.find((rp) => rp.role === user.role)
  return rolePerm?.permissions.includes(permission) ?? false
}

/**
 * API guard — call at the top of a route handler. Returns:
 *   - { user }                  → caller is authenticated AND has the permission
 *   - { response: NextResponse} → 401 (no auth) or 403 (no permission); return it directly
 *
 * Usage:
 *   const gate = await requirePermission(request, "patients.edit")
 *   if ("response" in gate) return gate.response
 *   const { user } = gate
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<{ user: JWTPayload } | { response: NextResponse }> {
  const user = await getRequestUser(request)
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!userHasPermission(user, permission)) {
    return {
      response: NextResponse.json(
        { error: `Forbidden — your role (${user.role}) lacks permission: ${permission}` },
        { status: 403 }
      ),
    }
  }
  return { user }
}
