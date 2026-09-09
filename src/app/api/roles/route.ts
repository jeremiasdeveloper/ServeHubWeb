// GET /api/roles
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { PERMISSIONS, getRolePermissions } from "@/lib/permissions"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "roles.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const roles = await db.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } })
  const enriched = roles.map((r) => ({
    ...r,
    permissions: (() => { try { return JSON.parse(r.permissions || "[]") } catch { return [] } })(),
    userCount: r._count.users,
  }))
  return Response.json({ roles: enriched, permissions: PERMISSIONS, defaults: Object.fromEntries(Object.entries({ Administrator: getRolePermissions("Administrator"), Manager: getRolePermissions("Manager"), Supervisor: getRolePermissions("Supervisor"), Waiter: getRolePermissions("Waiter"), "Kitchen Staff": getRolePermissions("Kitchen Staff"), Cashier: getRolePermissions("Cashier"), Employee: getRolePermissions("Employee") })) })
}
