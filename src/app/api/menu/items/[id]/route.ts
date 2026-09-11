// PATCH /api/menu/items/[id] — edit item / availability / disable (menu.edit | menu.disable)
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })

  let body: {
    name?: string
    categoryId?: string
    price?: number
    description?: string | null
    available?: boolean
    active?: boolean
  }
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  const { id } = await params

  // Availability toggle only needs menu.edit; full deactivation needs menu.disable.
  const isDisable = body.active !== undefined && Object.keys(body).length === 1 && body.active === false
  if (isDisable) {
    if (!hasPermission(user, "menu.disable") && !hasPermission(user, "menu.edit")) {
      return Response.json({ error: "No autorizado" }, { status: 403 })
    }
  } else if (!hasPermission(user, "menu.edit")) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 80) return Response.json({ error: "Nombre de producto inválido" }, { status: 400 })
    data.name = name
  }
  if (body.categoryId !== undefined) data.categoryId = body.categoryId
  if (body.price !== undefined) {
    if (typeof body.price !== "number" || body.price < 0 || !Number.isFinite(body.price)) {
      return Response.json({ error: "Precio inválido" }, { status: 400 })
    }
    data.price = body.price
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if (body.available !== undefined) data.available = body.available
  if (body.active !== undefined) data.active = body.active

  try {
    const item = await db.menuItem.update({ where: { id }, data })
    await db.auditLog.create({ data: { userId: user.id, action: "MENU_ITEM_UPDATE", entity: "MenuItem", entityId: id } })
    return Response.json({ item })
  } catch {
    return Response.json({ error: "Producto no encontrado" }, { status: 404 })
  }
}
