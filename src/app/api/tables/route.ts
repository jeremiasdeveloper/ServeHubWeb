// GET /api/tables  | POST /api/tables
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { TABLE_STATUSES } from "@/lib/order-state"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "tables.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const tables = await db.table.findMany({ orderBy: { number: "asc" }, include: { orders: { where: { status: { in: ["DRAFT", "SENT", "RECEIVED", "PREPARING", "READY", "DELIVERED"] } }, take: 1, orderBy: { createdAt: "desc" } } } })
  return Response.json({ tables, statuses: TABLE_STATUSES })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "tables.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { number?: string; capacity?: number; location?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  if (!body.number) return bad("Número de mesa requerido")
  const existing = await db.table.findUnique({ where: { number: body.number } })
  if (existing) return bad("Esa mesa ya existe", 409)
  const table = await db.table.create({ data: { number: body.number, capacity: body.capacity ?? 4, location: body.location ?? null } })
  await db.auditLog.create({ data: { userId: user.id, action: "TABLE_CREATE", entity: "Table", entityId: table.id } })
  return Response.json({ table }, { status: 201 })
}

// PATCH for status updates handled below in [id]/route.ts
