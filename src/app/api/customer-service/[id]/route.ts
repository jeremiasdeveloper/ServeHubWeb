// PATCH /api/customer-service/[id]
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "customerService.manage")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  let body: { status?: string; assignedToId?: string | null; subject?: string; description?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  const data: Record<string, unknown> = {}
  if (body.status) data.status = body.status
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null
  if (body.subject) data.subject = body.subject
  if (body.description) data.description = body.description
  const item = await db.customerService.update({ where: { id }, data })
  return Response.json({ item })
}
