// GET /api/notifications | PATCH /api/notifications/[id]
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "notifications.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const url = new URL(req.url)
  const onlyUnread = url.searchParams.get("unread") === "1"
  const notifications = await db.notification.findMany({
    where: { userId: user.id, ...(onlyUnread ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const unread = await db.notification.count({ where: { userId: user.id, read: false } })
  return Response.json({ notifications, unread })
}

export async function PATCH(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  // mark all as read
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } })
  return Response.json({ ok: true })
}
