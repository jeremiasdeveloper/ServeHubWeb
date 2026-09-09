// GET /api/employees | POST /api/employees
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { hashPassword } from "@/lib/auth"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "employees.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const employees = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, displayName: true, email: true, active: true, createdAt: true, lastLoginAt: true, roleId: true, role: true, permissions: true },
  })
  const roles = await db.role.findMany({ orderBy: { name: "asc" } })
  return Response.json({ employees, roles })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "employees.create")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { username?: string; displayName?: string; email?: string; roleId?: string; password?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  if (!body.username || !body.displayName || !body.roleId || !body.password) return bad("Faltan campos requeridos")
  const exists = await db.user.findUnique({ where: { username: body.username.toLowerCase() } })
  if (exists) return bad("El usuario ya existe", 409)
  const passwordHash = await hashPassword(body.password)
  const emp = await db.user.create({
    data: { username: body.username.toLowerCase(), displayName: body.displayName, email: body.email, roleId: body.roleId, passwordHash, permissions: "[]" },
    include: { role: true },
  })
  await db.auditLog.create({ data: { userId: user.id, action: "EMPLOYEE_CREATE", entity: "User", entityId: emp.id } })
  return Response.json({ employee: emp }, { status: 201 })
}
