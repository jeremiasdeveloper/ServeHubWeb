// PATCH /api/complaints/[id] — update status/assignment/resolution
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { emitRealtime } from "@/lib/realtime"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "complaints.resolve")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  let body: { status?: string; assignedToId?: string | null; priority?: string; resolution?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  const data: Record<string, unknown> = {}
  if (body.status) data.status = body.status
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null
  if (body.priority) data.priority = body.priority
  if (body.resolution !== undefined) data.resolution = body.resolution
  const complaint = await db.complaint.update({ where: { id }, data, include: { assignedTo: { select: { id: true, displayName: true } } } })
  if (body.assignedToId && body.assignedToId !== user.id) {
    await db.notification.create({
      data: {
        userId: body.assignedToId,
        type: "COMPLAINT_ASSIGNED",
        title: "Queja asignada",
        body: `Se te asignó la queja: ${complaint.title}`,
        data: JSON.stringify({ complaintId: complaint.id }),
      },
    })
    await emitRealtime({ type: "notification.created", userId: body.assignedToId, title: "Queja asignada", body: `Se te asignó la queja: ${complaint.title}`, ntype: "COMPLAINT_ASSIGNED" })
  }
  await db.auditLog.create({ data: { userId: user.id, action: "COMPLAINT_UPDATE", entity: "Complaint", entityId: complaint.id } })
  return Response.json({ complaint })
}
