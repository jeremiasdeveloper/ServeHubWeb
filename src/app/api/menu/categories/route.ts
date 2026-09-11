// POST /api/menu/categories — create a menu category (menu.create)
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "menu.create")) return Response.json({ error: "No autorizado" }, { status: 403 })

  let body: { name?: string; sortOrder?: number }
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  const name = body.name?.trim()
  if (!name || name.length > 60) return Response.json({ error: "Nombre de categoría inválido" }, { status: 400 })

  const existing = await db.menuCategory.findUnique({ where: { name } })
  if (existing) return Response.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 })

  const category = await db.menuCategory.create({ data: { name, sortOrder: body.sortOrder ?? 0 } })
  await db.auditLog.create({ data: { userId: user.id, action: "MENU_CATEGORY_CREATE", entity: "MenuCategory", entityId: category.id, details: name } })
  return Response.json({ category }, { status: 201 })
}
