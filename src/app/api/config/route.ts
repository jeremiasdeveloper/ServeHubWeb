// GET /api/config — public restaurant configuration (no auth)
import { getConfig } from "@/lib/config"
import { db } from "@/lib/db"

export async function GET() {
  const config = getConfig()
  // enrich with counts for splash / health
  let counts = { users: 0, tables: 0, orders: 0 }
  try {
    const [users, tables, orders] = await Promise.all([
      db.user.count(),
      db.table.count(),
      db.order.count(),
    ])
    counts = { users, tables, orders }
  } catch {}
  return Response.json({ ...config, counts })
}
