// ServeHub — server-side authorization helpers
//
// Permission resolution order (server-authoritative):
//   1. User override permissions (User.permissions JSON column)
//   2. Role permissions stored in the database (Role.permissions JSON column)
//      — edited at runtime via PATCH /api/roles/[id]
//   3. Built-in defaults for system roles (ROLE_PERMISSIONS), used when the
//      role has no stored set (e.g. freshly-created custom roles).

import { getRolePermissions } from "./permissions"

export interface AuthUser {
  id: string
  username: string
  displayName: string
  email: string | null
  roleId: string
  role: { id: string; name: string; permissions?: string | null }
  permissions: string
  active: boolean
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : []
  } catch {
    return []
  }
}

export function userPermissions(user: Pick<AuthUser, "role" | "permissions">): string[] {
  // Role-level: stored DB set wins; fall back to built-in defaults.
  const storedRolePerms = parseJsonArray(user.role.permissions)
  const rolePerms = storedRolePerms.length > 0 ? storedRolePerms : getRolePermissions(user.role.name)
  const userExtra = parseJsonArray(user.permissions)
  return Array.from(new Set([...rolePerms, ...userExtra]))
}

export function hasPermission(user: Pick<AuthUser, "role" | "permissions">, perm: string): boolean {
  return userPermissions(user).includes(perm)
}

export function hasAnyPermission(user: Pick<AuthUser, "role" | "permissions">, perms: string[]): boolean {
  const set = userPermissions(user)
  return perms.some((p) => set.includes(p))
}

export function unauthorizedResponse(message = "No autorizado") {
  return Response.json({ error: message }, { status: 403 })
}

export function unauthenticatedResponse(message = "No autenticado") {
  return Response.json({ error: message }, { status: 401 })
}
