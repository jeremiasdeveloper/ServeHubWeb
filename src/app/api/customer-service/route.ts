// GET /api/customer-service | POST /api/customer-service
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "customerService.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const items = await db.customerService.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
  return Response.json({ items })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "customerService.manage")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { subject?: string; description?: string; channel?: string; customerName?: string; customerContact?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  if (!body.subject || !body.description) return bad("Asunto y descripción requeridos")
  const item = await db.customerService.create({
    data: {
      subject: body.subject,
      description: body.description,
      channel: body.channel ?? "IN_PERSON",
      customerName: body.customerName,
      customerContact: body.customerContact,
      status: "OPEN",
    },
  })
  await db.auditLog.create({ data: { userId: user.id, action: "CS_CREATE", entity: "CustomerService", entityId: item.id } })
  return Response.json({ item }, { status: 201 })
}
