// GET /api/setup — first-run setup status (public)
// POST /api/setup — complete first-run setup (only when no users exist)
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { saveConfig, getConfig } from "@/lib/config"
import { getServerIdentity } from "@/lib/server-identity"
import { seedProductionBaseline } from "@/lib/seed"
import { ROLE_PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  try {
    const [userCount, { serverId }] = await Promise.all([db.user.count(), getServerIdentity()])
    return Response.json({ needsSetup: userCount === 0, serverId })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "setup status failed" }, { status: 500 })
  }
}

interface SetupBody {
  restaurant?: { name?: string; id?: string; logo?: string | null; tagline?: string }
  branding?: { primaryColor?: string; secondaryColor?: string; accentColor?: string }
  appearance?: { font?: string }
  localization?: { defaultLanguage?: string }
  admin?: { username?: string; password?: string; displayName?: string }
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")

export async function POST(req: Request) {
  let body: SetupBody
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  // Guard: setup is only allowed on a virgin installation.
  const userCount = await db.user.count()
  if (userCount > 0) return Response.json({ error: "El sistema ya está configurado" }, { status: 409 })

  const name = body.restaurant?.name?.trim()
  const username = body.admin?.username?.trim()
  const password = body.admin?.password ?? ""

  if (!name || name.length < 2) return Response.json({ error: "Nombre de restaurante inválido" }, { status: 400 })
  if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return Response.json({ error: "Usuario inválido (3-32 caracteres alfanuméricos)" }, { status: 400 })
  }
  if (password.length < 8) return Response.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })

  const restaurantId = slugify(body.restaurant?.id?.trim() || name)

  // Ensure system roles exist, then create the first administrator.
  await seedProductionBaseline()
  const adminRole = await db.role.findUnique({ where: { name: "Administrador" } })
  if (!adminRole) return Response.json({ error: "No se pudo crear el rol administrador" }, { status: 500 })

  const user = await db.user.create({
    data: {
      username,
      displayName: body.admin?.displayName?.trim() || username,
      passwordHash: await hashPassword(password),
      roleId: adminRole.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS["Administrador"] ?? []),
      active: true,
    },
  })

  await saveConfig({
    restaurant: { name, id: restaurantId, logo: body.restaurant?.logo ?? null, tagline: body.restaurant?.tagline },
    branding: body.branding,
    appearance: body.appearance,
    localization: { defaultLanguage: body.localization?.defaultLanguage === "en" ? "en" : "es" },
  })

  const { serverId } = await getServerIdentity()
  await db.auditLog.create({
    data: { userId: user.id, action: "SETUP_COMPLETE", entity: "System", details: JSON.stringify({ restaurant: name, restaurantId, username }) },
  })

  const config = await getConfig()
  return Response.json({ ok: true, serverId, restaurantId, config }, { status: 201 })
}
