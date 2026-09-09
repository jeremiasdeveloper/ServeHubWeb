// GET /api/orders — list orders (with filters)
// POST /api/orders — create a new order (DRAFT or SENT)
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { emitRealtime } from "@/lib/realtime"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "orders.view")) return Response.json({ error: "No autorizado" }, { status: 403 })

  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const assignedToMe = url.searchParams.get("mine") === "1"

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (assignedToMe) where.assignedToId = user.id

  const orders = await db.order.findMany({
    where,
    include: {
      table: true,
      createdBy: { select: { id: true, username: true, displayName: true } },
      assignedTo: { select: { id: true, username: true, displayName: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return Response.json({ orders })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "orders.create")) return Response.json({ error: "No autorizado" }, { status: 403 })

  let body: {
    tableId?: string
    items?: { name: string; quantity?: number; price?: number; notes?: string }[]
    notes?: string
    send?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return bad("JSON inválido")
  }
  if (!body.tableId || !body.items || body.items.length === 0) {
    return bad("Mesa e ítems son requeridos")
  }

  const table = await db.table.findUnique({ where: { id: body.tableId } })
  if (!table) return bad("Mesa no encontrada", 404)

  // next order number
  const max = await db.order.findFirst({ orderBy: { number: "desc" }, select: { number: true } })
  const number = (max?.number ?? 1040) + 1

  const total = body.items.reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0)
  const status = body.send ? "SENT" : "DRAFT"

  const order = await db.order.create({
    data: {
      number,
      tableId: body.tableId,
      createdById: user.id,
      status,
      notes: body.notes ?? null,
      total,
      items: {
        create: body.items.map((it) => ({
          name: it.name,
          quantity: it.quantity ?? 1,
          price: it.price ?? 0,
          notes: it.notes ?? null,
        })),
      },
      history: {
        create: { fromStatus: null, toStatus: "DRAFT", changedById: user.id },
      },
    },
    include: { table: true, items: true, createdBy: { select: { username: true, displayName: true } } },
  })

  if (body.send) {
    await db.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: "DRAFT", toStatus: "SENT", changedById: user.id },
    })
    await db.table.update({ where: { id: body.tableId }, data: { status: "OCCUPIED" } }).catch(() => {})
    await emitRealtime({ type: "order.created", orderId: order.id, tableNumber: table.number, status: "SENT" })
    // notify kitchen staff
    const kitchen = await db.user.findMany({
      where: { role: { name: "Kitchen Staff" }, active: true },
      select: { id: true },
    })
    for (const k of kitchen) {
      await db.notification.create({
        data: {
          userId: k.id,
          type: "NEW_ORDER",
          title: "Nueva orden recibida",
          body: `Orden #${number} — Mesa ${table.number}`,
          data: JSON.stringify({ orderId: order.id, tableNumber: table.number }),
        },
      })
      await emitRealtime({ type: "notification.created", userId: k.id, title: "Nueva orden recibida", body: `Orden #${number} — Mesa ${table.number}`, ntype: "NEW_ORDER" })
    }
  }

  await db.auditLog.create({ data: { userId: user.id, action: "ORDER_CREATE", entity: "Order", entityId: order.id } })

  return Response.json({ order }, { status: 201 })
}
