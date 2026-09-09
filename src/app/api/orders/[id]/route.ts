// GET /api/orders/[id] — order detail
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "orders.view")) return Response.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: {
      table: true,
      createdBy: { select: { id: true, username: true, displayName: true } },
      assignedTo: { select: { id: true, username: true, displayName: true } },
      items: true,
      history: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!order) return Response.json({ error: "Orden no encontrada" }, { status: 404 })
  return Response.json({ order })
}
