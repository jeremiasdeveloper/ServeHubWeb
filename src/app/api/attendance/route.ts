// GET /api/attendance | POST /api/attendance (check-in/check-out combined)
import { db } from "@/lib/db"
import { resolveUser, bad } from "@/lib/api"
import { hasPermission } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "attendance.view")) return Response.json({ error: "No autorizado" }, { status: 403 })
  const url = new URL(req.url)
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  const records = await db.attendance.findMany({
    where: { date },
    include: { user: { select: { id: true, username: true, displayName: true, role: { select: { name: true } } } } },
    orderBy: { checkIn: "asc" },
  })
  return Response.json({ records, date })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "attendance.self") && !hasPermission(user, "attendance.edit")) return Response.json({ error: "No autorizado" }, { status: 403 })
  let body: { action?: "in" | "out" }
  try { body = await req.json() } catch { return bad("JSON inválido") }
  const action = body.action ?? "in"
  const today = new Date().toISOString().slice(0, 10)
  const existing = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date: today } } })
  if (action === "in") {
    if (existing?.checkIn) return bad("Ya registraste entrada hoy")
    const rec = await db.attendance.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: { checkIn: new Date(), status: "PRESENT" },
      create: { userId: user.id, date: today, checkIn: new Date(), status: "PRESENT" },
    })
    return Response.json({ record: rec })
  } else {
    if (!existing?.checkIn) return bad("No has registrado entrada hoy")
    if (existing.checkOut) return bad("Ya registraste salida hoy")
    const rec = await db.attendance.update({ where: { id: existing.id }, data: { checkOut: new Date() } })
    return Response.json({ record: rec })
  }
}
