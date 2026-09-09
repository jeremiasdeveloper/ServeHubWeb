"use client"

import { useApp } from "./store"

export function usePermissions() {
  const user = useApp((s) => s.user)
  const perms = user?.permissions ?? []
  return {
    can: (perm: string) => perms.includes(perm),
    any: (...ps: string[]) => ps.some((p) => perms.includes(p)),
    isAdmin: perms.includes("admin.access"),
    isDeveloper: perms.includes("developer.access"),
    perms,
  }
}
