// PATCH /api/roles/[id] — update role permissions/description
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "roles.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  let body: { permissions?: string[]; description?: string; name?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  const data: Record<string, unknown> = {}
  if (body.permissions) data.permissions = JSON.stringify(body.permissions)
  if (body.description !== undefined) data.description = body.description
  if (body.name) data.name = body.name
  const role = await db.role.update({ where: { id }, data })
  await db.auditLog.create({ data: { userId: user.id, action: "ROLE_UPDATE", entity: "Role", entityId: role.id } })
  return Response.json({ role })
}
