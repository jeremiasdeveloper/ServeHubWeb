// GET /api/menu — full menu (categories with items). Auth: menu.view.
// Mutations live under /api/menu/categories and /api/menu/items.
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "menu.view")) return Response.json({ error: "No autorizado" }, { status: 403 })

  const categories = await db.menuCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  })
  return Response.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: i.price,
        available: i.available,
        active: i.active,
      })),
    })),
  })
}
