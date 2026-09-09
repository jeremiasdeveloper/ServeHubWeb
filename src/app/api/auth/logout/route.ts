// POST /api/auth/logout
import { extractToken, destroySession, clearSessionCookieHeader } from "@/lib/auth"

export async function POST(req: Request) {
  const token = extractToken(req)
  if (token) await destroySession(token)
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookieHeader() } })
}
