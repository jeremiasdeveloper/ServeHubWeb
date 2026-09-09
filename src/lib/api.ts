// ServeHub — API route helpers

import { db } from "./db"
import { extractToken, getUserFromToken } from "./auth"
import { userPermissions, type AuthUser } from "./authz"

export interface ApiContext {
  user: AuthUser & { role: { id: string; name: string } }
  perms: string[]
}

// Resolve the authenticated user from a request, or null.
export async function resolveUser(req: Request) {
  const token = extractToken(req)
  const user = await getUserFromToken(token)
  if (!user) return null
  return user as unknown as ApiContext["user"] & { role: { id: string; name: string } }
}

export function requireUser(req: Request) {
  return resolveUser(req)
}

export function permsOf(user: ApiContext["user"]): string[] {
  return userPermissions(user)
}

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

export function notFound(message = "No encontrado") {
  return Response.json({ error: message }, { status: 404 })
}

export { db }
