// PATCH /api/menu/categories/[id] — rename/reorder/deactivate (menu.edit)
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "menu.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  let body: { name?: string; sortOrder?: number; active?: boolean }
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 60) return Response.json({ error: "Nombre de categoría inválido" }, { status: 400 })
    data.name = name
  }
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder
  if (body.active !== undefined) data.active = body.active

  try {
    const category = await db.menuCategory.update({ where: { id }, data })
    await db.auditLog.create({ data: { userId: user.id, action: "MENU_CATEGORY_UPDATE", entity: "MenuCategory", entityId: id } })
    return Response.json({ category })
  } catch {
    return Response.json({ error: "Categoría no encontrada" }, { status: 404 })
  }
}
