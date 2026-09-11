// GET /api/auth/me — current authenticated user
import { resolveUser } from "@/lib/api"
import { userPermissions } from "@/lib/authz"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ user: null }, { status: 401 })
  const perms = userPermissions(user)
  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: { id: user.role.id, name: user.role.name },
      permissions: perms,
      isAdmin: perms.includes("admin.access"),
      active: user.active,
    },
  })
}
