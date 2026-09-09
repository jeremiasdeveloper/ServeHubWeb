// PATCH /api/tables/[id] — update table (status, capacity, location)
// DELETE /api/tables/[id]
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { TABLE_STATUSES } from "@/lib/order-state"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "tables.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  let body: { status?: string; capacity?: number; location?: string; number?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  if (body.status && !TABLE_STATUSES.includes(body.status as never)) return bad("Estado inválido")
  const table = await db.table.update({ where: { id }, data: { status: body.status, capacity: body.capacity, location: body.location, number: body.number } })
  await db.auditLog.create({ data: { userId: user.id, action: "TABLE_UPDATE", entity: "Table", entityId: table.id } })
  return Response.json({ table })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "tables.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  await db.table.delete({ where: { id } })
  await db.auditLog.create({ data: { userId: user.id, action: "TABLE_DELETE", entity: "Table", entityId: id } })
  return Response.json({ ok: true })
}
