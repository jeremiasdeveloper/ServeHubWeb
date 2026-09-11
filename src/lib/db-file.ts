// ServeHub — SQLite database file resolution for backup/restore.
// Mirrors Prisma's resolution: absolute file: URLs are used as-is; relative
// paths resolve against the prisma/ schema directory (dev layout).

import path from "path"

export function resolveDbFile(): string | null {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.startsWith("file:")) return null
  const raw = url.slice("file:".length).replace(/\?.*$/, "")
  if (path.isAbsolute(raw)) return path.normalize(raw)
  return path.resolve(process.cwd(), "prisma", raw)
}

// A restore staged as <db>.restore-pending is applied on the next server
// start (before Prisma opens the database) by src/lib/bootstrap.ts.
export const RESTORE_SUFFIX = ".restore-pending"
