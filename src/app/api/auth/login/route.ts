// POST /api/auth/login
import { db } from "@/lib/db"
import { verifyPassword, createSession, sessionCookieHeader } from "@/lib/auth"
import { userPermissions } from "@/lib/authz"

export async function POST(req: Request) {
  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  const username = (body.username || "").trim().toLowerCase()
  const password = body.password || ""
  if (!username || !password) {
    return Response.json({ error: "Usuario y contraseña requeridos" }, { status: 400 })
  }
  const user = await db.user.findUnique({
    where: { username },
    include: { role: true },
  })
  if (!user || !user.active) {
    return Response.json({ error: "Credenciales inválidas" }, { status: 401 })
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return Response.json({ error: "Credenciales inválidas" }, { status: 401 })
  }
  const token = await createSession(user.id)

  await db.auditLog.create({
    data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id },
  })

  const perms = userPermissions(user)

  return Response.json(
    {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: { id: user.role.id, name: user.role.name },
        permissions: perms,
        isAdmin: perms.includes("admin.access"),
      },
      token,
    },
    { headers: { "Set-Cookie": sessionCookieHeader(token) } }
  )
}
