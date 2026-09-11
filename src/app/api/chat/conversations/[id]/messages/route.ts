// GET /api/chat/conversations/[id]/messages — list messages of a conversation
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "chat.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await params
  const part = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: id, userId: user.id } } })
  if (!part) return Response.json({ error: "No tienes acceso a esta conversación" }, { status: 403 })
  const messages = await db.message.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, username: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  })
  await db.conversationParticipant.update({ where: { id: part.id }, data: { lastReadAt: new Date() } })
  return Response.json({ messages })
}
