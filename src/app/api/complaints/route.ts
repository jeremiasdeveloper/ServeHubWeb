// GET /api/complaints | POST /api/complaints
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { emitRealtime } from "@/lib/realtime"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "complaints.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  const complaints = await db.complaint.findMany({
    where,
    include: {
      createdBy: { select: { id: true, username: true, displayName: true } },
      assignedTo: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return Response.json({ complaints })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "complaints.create")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { title?: string; description?: string; category?: string; priority?: string; customerName?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  if (!body.title || !body.description) return bad("Título y descripción requeridos")
  const complaint = await db.complaint.create({
    data: {
      title: body.title,
      description: body.description,
      category: body.category ?? "GENERAL",
      priority: body.priority ?? "NORMAL",
      status: "OPEN",
      createdById: user.id,
      customerName: body.customerName,
    },
    include: { createdBy: { select: { username: true, displayName: true } } },
  })
  await db.auditLog.create({ data: { userId: user.id, action: "COMPLAINT_CREATE", entity: "Complaint", entityId: complaint.id } })
  return Response.json({ complaint }, { status: 201 })
}
