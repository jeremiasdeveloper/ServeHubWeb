// POST /api/orders/[id]/transition — advance order status
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { canTransition, nextStatuses, TRANSITION_PERMISSIONS } from "@/lib/order-state"
import { emitRealtime } from "@/lib/realtime"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  let body: { to?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return bad("JSON inválido")
  }
  const to = (body.to || "").toUpperCase()
  const order = await db.order.findUnique({ where: { id }, include: { table: true, assignedTo: true } })
  if (!order) return Response.json({ error: "Orden no encontrada" }, { status: 404 })

  if (!canTransition(order.status, to)) {
    return bad(`Transición inválida: ${order.status} → ${to}. Válidas: ${nextStatuses(order.status).join(", ") || "ninguna"}`)
  }

  const requiredPerm = TRANSITION_PERMISSIONS[`${order.status}->${to}`]
  if (requiredPerm && !hasPermission(user, requiredPerm)) {
    return Response.json({ error: `Sin permiso para esta acción (${requiredPerm})` }, { status: 403 })
  }

  const updated = await db.order.update({
    where: { id },
    data: {
      status: to,
      updatedAt: new Date(),
      assignedToId: order.assignedToId ?? (to === "RECEIVED" || to === "PREPARING" ? user.id : order.assignedToId),
      history: {
        create: { fromStatus: order.status, toStatus: to, changedById: user.id, note: body.note },
      },
    },
    include: { table: true, items: true, assignedTo: { select: { id: true, username: true, displayName: true } } },
  })

  await emitRealtime({ type: "order.updated", orderId: order.id, from: order.status, to, tableNumber: order.table.number })

  // side effects
  if (to === "READY") {
    const target = order.assignedToId ?? order.createdById
    await db.notification.create({
      data: {
        userId: target,
        type: "ORDER_READY",
        title: "Orden lista",
        body: `Orden #${order.number} — Mesa ${order.table.number} lista para entregar.`,
        data: JSON.stringify({ orderId: order.id, tableNumber: order.table.number }),
      },
    })
    await emitRealtime({ type: "order.ready", orderId: order.id, tableNumber: order.table.number, assignedToId: target })
    await emitRealtime({ type: "notification.created", userId: target, title: "Orden lista", body: `Orden #${order.number} — Mesa ${order.table.number} lista`, ntype: "ORDER_READY" })
  }
  if (to === "DELIVERED") {
    await emitRealtime({ type: "order.delivered", orderId: order.id, tableNumber: order.table.number })
  }
  if (to === "COMPLETED" || to === "CANCELLED") {
    await db.table.update({ where: { id: order.tableId }, data: { status: "NEEDS_CLEANING" } }).catch(() => {})
  }

  await db.auditLog.create({ data: { userId: user.id, action: `ORDER_${to}`, entity: "Order", entityId: order.id, details: `${order.status}->${to}` } })

  return Response.json({ order: updated })
}
