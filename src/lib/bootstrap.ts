// ServeHub — server bootstrap (user initialization)
//
// Ensures the database always has the core roles and demo users available
// when the server starts. This runs from src/instrumentation.ts, which
// Next.js executes once per server process start.
//
// It is deliberately conservative: it only seeds when the roles or users
// tables are empty, so real data created by the team is never touched or
// re-created on every boot.

import { db } from "./db"

export async function ensureUsersInitialized(): Promise<void> {
  try {
    const [roleCount, userCount] = await Promise.all([db.role.count(), db.user.count()])
    if (roleCount === 0 || userCount === 0) {
      const { seedDatabase } = await import("./seed")
      const result = await seedDatabase()
      console.log(
        `[bootstrap] initialized ${result.roles} roles / ${result.users} users / ${result.tables} tables (database was empty)`
      )
    }
  } catch (e) {
    // Never crash the server because of bootstrap issues (e.g. migrations
    // not applied yet); the app surfaces DB errors through /api/health.
    console.error("[bootstrap] user initialization skipped:", e instanceof Error ? e.message : e)
  }
}
