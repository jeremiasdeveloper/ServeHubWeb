// PATCH /api/employees/[id] | DELETE /api/employees/[id]
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { hashPassword } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "employees.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  let body: { displayName?: string; email?: string; roleId?: string; active?: boolean; password?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  const data: Record<string, unknown> = {}
  if (body.displayName !== undefined) data.displayName = body.displayName
  if (body.email !== undefined) data.email = body.email
  if (body.roleId !== undefined) data.roleId = body.roleId
  if (body.active !== undefined) data.active = body.active
  if (body.password) data.passwordHash = await hashPassword(body.password)
  const emp = await db.user.update({ where: { id }, data, include: { role: true } })
  await db.auditLog.create({ data: { userId: user.id, action: "EMPLOYEE_UPDATE", entity: "User", entityId: emp.id } })
  return Response.json({ employee: emp })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "employees.disable")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  // soft disable rather than delete to preserve referential integrity
  const emp = await db.user.update({ where: { id }, data: { active: false } })
  await db.auditLog.create({ data: { userId: user.id, action: "EMPLOYEE_DISABLE", entity: "User", entityId: emp.id } })
  return Response.json({ ok: true })
}
