// PATCH /api/notifications/[id] — mark single notification as read
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  const { id } = await params
  const n = await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } })
  if (n.count === 0) return Response.json({ error: "Notificación no encontrada" }, { status: 404 })
  return Response.json({ ok: true })
}
