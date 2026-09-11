// ServeHub — server bootstrap (production baseline)
//
// Runs from src/instrumentation.ts once per server process start. On an
// empty database it seeds ONLY the system roles and the stable server
// identity — never demo users or sample content. The first administrator
// account is created through the first-run setup wizard (POST /api/setup).

import { db } from "./db"
import { resolveDbFile, RESTORE_SUFFIX } from "./db-file"
import fs from "fs"

// Applies a staged database restore (<db>.restore-pending) before Prisma
// opens the database. Runs at process start, so the swap is safe.
export function applyPendingRestore(): void {
  try {
    const dbFile = resolveDbFile()
    if (!dbFile) return
    const pending = dbFile + RESTORE_SUFFIX
    if (fs.existsSync(pending)) {
      if (fs.existsSync(dbFile)) fs.rmSync(dbFile)
      fs.renameSync(pending, dbFile)
      console.log("[bootstrap] pending database restore applied")
    }
  } catch (e) {
    console.error("[bootstrap] restore application failed:", e instanceof Error ? e.message : e)
  }
}

export async function ensureUsersInitialized(): Promise<void> {
  applyPendingRestore()
  try {
    const roleCount = await db.role.count()
    if (roleCount === 0) {
      const { seedProductionBaseline } = await import("./seed")
      const result = await seedProductionBaseline()
      console.log(`[bootstrap] production baseline initialized: ${result.roles} roles (database was empty)`)
    } else {
      // Make sure a server identity always exists, even on pre-1.0 databases.
      const { getServerIdentity } = await import("./server-identity")
      await getServerIdentity()
    }
  } catch (e) {
    // Never crash the server because of bootstrap issues (e.g. migrations
    // not applied yet); the app surfaces DB errors through /api/health.
    console.error("[bootstrap] initialization skipped:", e instanceof Error ? e.message : e)
  }
}
