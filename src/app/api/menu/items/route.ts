// POST /api/menu/items — create a menu item (menu.create)
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "menu.create")) return Response.json({ error: "No autorizado" }, { status: 403 })

  let body: { name?: string; categoryId?: string; price?: number; description?: string }
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  const name = body.name?.trim()
  if (!name || name.length > 80) return Response.json({ error: "Nombre de producto inválido" }, { status: 400 })
  if (!body.categoryId) return Response.json({ error: "Categoría requerida" }, { status: 400 })
  if (typeof body.price !== "number" || body.price < 0 || !Number.isFinite(body.price)) {
    return Response.json({ error: "Precio inválido" }, { status: 400 })
  }

  const category = await db.menuCategory.findUnique({ where: { id: body.categoryId } })
  if (!category) return Response.json({ error: "Categoría no encontrada" }, { status: 404 })

  const existing = await db.menuItem.findUnique({ where: { name } })
  if (existing) return Response.json({ error: "Ya existe un producto con ese nombre" }, { status: 409 })

  const item = await db.menuItem.create({
    data: { name, categoryId: body.categoryId, price: body.price, description: body.description?.trim() || null },
  })
  await db.auditLog.create({ data: { userId: user.id, action: "MENU_ITEM_CREATE", entity: "MenuItem", entityId: item.id, details: name } })
  return Response.json({ item }, { status: 201 })
}
