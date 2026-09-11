// GET /api/developer — developer mode info (config, server status, db tables)
// POST /api/developer — developer actions (re-seed demo data)
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { getConfig } from "@/lib/config"
import { PERMISSIONS } from "@/lib/permissions"
import { seedDatabase } from "@/lib/seed"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "developer.access")) return Response.json({ error: "No autorizado" }, { status: 403 })

  const config = await getConfig()
  const tables = ["User", "Role", "Session", "Table", "Order", "OrderItem", "OrderStatusHistory", "Complaint", "CustomerService", "Conversation", "ConversationParticipant", "Message", "Attendance", "Notification", "RestaurantSetting", "AuditLog", "MenuCategory", "MenuItem"]
  // Prisma client property for each model (most are lowercased; compound
  // names like MenuCategory become menuCategory).
  const prismaModel: Record<string, string> = { MenuCategory: "menuCategory", MenuItem: "menuItem", OrderItem: "orderItem", OrderStatusHistory: "orderStatusHistory", ConversationParticipant: "conversationParticipant", CustomerService: "customerService", RestaurantSetting: "restaurantSetting", AuditLog: "auditLog" }

  const counts: Record<string, number> = {}
  for (const t of tables) {
    try {
      counts[t] = await (db as unknown as Record<string, { count: () => Promise<number> }>)[prismaModel[t] ?? t.toLowerCase()].count()
    } catch {
      counts[t] = -1
    }
  }

  let realtime: Record<string, unknown> = { status: "offline" }
  try {
    const r = await fetch("http://localhost:3004/health")
    if (r.ok) realtime = { status: "ok", ...(await r.json()) }
  } catch {}

  const roles = await db.role.findMany({ select: { name: true, permissions: true } })

  return Response.json({
    config,
    permissions: PERMISSIONS,
    counts,
    realtime,
    roles: roles.map((r) => ({ name: r.name, permissions: (() => { try { return JSON.parse(r.permissions || "[]") } catch { return [] } })() })),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      runtime: "Next.js 16 (App Router)",
      database: "SQLite via Prisma",
      realtimeService: "socket.io @ port 3003",
      serverTime: new Date().toISOString(),
    },
  })
}

// POST /api/developer — developer tools. Body: { action: "reseed" }
export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "developer.access")) return Response.json({ error: "No autorizado" }, { status: 403 })

  let body: { action?: string }
  try { body = await req.json() } catch { body = {} }

  if (body.action === "reseed") {
    try {
      const result = await seedDatabase()
      await db.auditLog.create({
        data: { userId: user.id, action: "DEV_RESEED", entity: "Database", entityId: "seed" },
      })
      return Response.json({ ok: true, result })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "seed failed" }, { status: 500 })
    }
  }

  return Response.json({ error: "Acción desconocida" }, { status: 400 })
}
