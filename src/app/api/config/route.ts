// GET /api/config — public restaurant configuration (no auth).
// Includes the stable server identity so Android clients can verify which
// restaurant they are connecting to before authenticating.
// PATCH /api/config — update persisted config (settings.edit permission).
import { getConfig, saveConfig } from "@/lib/config"
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { getServerIdentity } from "@/lib/server-identity"

export async function GET() {
  const config = await getConfig()
  let counts = { users: 0, tables: 0, orders: 0 }
  let serverId = ""
  try {
    const [users, tables, orders, identity] = await Promise.all([
      db.user.count(),
      db.table.count(),
      db.order.count(),
      getServerIdentity(),
    ])
    counts = { users, tables, orders }
    serverId = identity.serverId
  } catch {}
  return Response.json({ ...config, counts, serverId })
}

export async function PATCH(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "settings.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })

  let patch: Record<string, unknown>
  try { patch = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  try {
    const config = await saveConfig(patch)
    await db.auditLog.create({
      data: { userId: user.id, action: "CONFIG_UPDATE", entity: "RestaurantSetting", entityId: "servehub_config", details: JSON.stringify(patch).slice(0, 500) },
    })
    return Response.json({ ok: true, config })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "config update failed" }, { status: 500 })
  }
}
