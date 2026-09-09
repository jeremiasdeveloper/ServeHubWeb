// GET /api/health — service health
import { db } from "@/lib/db"

export async function GET() {
  const health: Record<string, unknown> = {
    web: "ok",
    time: new Date().toISOString(),
  }
  try {
    await db.user.count()
    health.database = "ok"
  } catch (e) {
    health.database = "error"
    health.databaseError = String(e)
  }
  try {
    const r = await fetch("http://localhost:3004/health")
    health.realtime = r.ok ? "ok" : "degraded"
  } catch {
    health.realtime = "offline"
  }
  return Response.json(health)
}
