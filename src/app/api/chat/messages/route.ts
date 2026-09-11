// POST /api/chat/messages — send a message
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { emitRealtime } from "@/lib/realtime"

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "chat.send")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { conversationId?: string; content?: string }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  if (!body.conversationId || !body.content?.trim()) return bad("Conversación y contenido requeridos")
  const part = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: body.conversationId, userId: user.id } } })
  if (!part) return Response.json({ error: "No tienes acceso a esta conversación" }, { status: 403 })

  const msg = await db.message.create({
    data: { conversationId: body.conversationId, senderId: user.id, content: body.content.trim() },
    include: { sender: { select: { id: true, username: true, displayName: true } } },
  })
  await db.conversation.update({ where: { id: body.conversationId }, data: { updatedAt: new Date() } })
  await db.conversationParticipant.update({ where: { id: part.id }, data: { lastReadAt: new Date() } })

  // notify other participants
  const others = await db.conversationParticipant.findMany({
    where: { conversationId: body.conversationId, NOT: { userId: user.id } },
    select: { userId: true },
  })
  for (const o of others) {
    await db.notification.create({
      data: { userId: o.userId, type: "NEW_MESSAGE", title: "Nuevo mensaje", body: `${user.displayName}: ${body.content.trim().slice(0, 80)}`, data: JSON.stringify({ conversationId: body.conversationId }) },
    })
    await emitRealtime({ type: "notification.created", userId: o.userId, title: "Nuevo mensaje", body: `${user.displayName}: ${body.content.trim().slice(0, 80)}`, ntype: "NEW_MESSAGE" })
  }
  await emitRealtime({ type: "message.created", conversationId: body.conversationId, senderId: user.id, senderName: user.displayName, content: body.content.trim() })

  return Response.json({ message: msg }, { status: 201 })
}
