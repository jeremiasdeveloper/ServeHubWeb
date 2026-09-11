// GET /api/chat/conversations — list conversations for current user
// POST /api/chat/conversations — create/open a conversation
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "chat.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const convos = await db.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: { select: { id: true, username: true, displayName: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  })
  return Response.json({ conversations: convos })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "chat.send")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { participantIds?: string[]; name?: string; isGroup?: boolean }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  const participantIds = Array.from(new Set([...(body.participantIds ?? []), user.id]))
  if (participantIds.length < 2) return bad("Se requieren al menos 2 participantes")

  // For 1:1, reuse existing conversation
  if (participantIds.length === 2 && !body.isGroup) {
    const existing = await db.conversation.findFirst({
      where: {
        isGroup: false,
        participants: { every: { userId: { in: participantIds } } },
        AND: [{ participants: { some: { userId: participantIds[0] } } }, { participants: { some: { userId: participantIds[1] } } }],
      },
      include: { participants: { include: { user: { select: { id: true, username: true, displayName: true } } } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (existing) {
      // verify exact 2 participants
      if (existing.participants.length === 2) return Response.json({ conversation: existing })
    }
  }

  const convo = await db.conversation.create({
    data: {
      name: body.name ?? (participantIds.length > 2 ? "Grupo" : null),
      isGroup: body.isGroup ?? participantIds.length > 2,
      participants: { create: participantIds.map((uid) => ({ userId: uid })) },
    },
    include: { participants: { include: { user: { select: { id: true, username: true, displayName: true } } } } },
  })
  return Response.json({ conversation: convo }, { status: 201 })
}
