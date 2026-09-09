// GET /api/settings — restaurant settings (admin/manager)
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "settings.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const settings = await db.restaurantSetting.findMany()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return Response.json({ settings: map })
}

export async function PATCH(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "settings.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: Record<string, string>
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }
  for (const [key, value] of Object.entries(body)) {
    await db.restaurantSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
  }
  await db.auditLog.create({ data: { userId: user.id, action: "SETTINGS_UPDATE", entity: "RestaurantSetting" } })
  return Response.json({ ok: true })
}
