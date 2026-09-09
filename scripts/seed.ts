// ServeHub — seed CLI
// Run with: bun run scripts/seed.ts
// Delegates to the shared seedDatabase() core (also used by the
// developer-mode re-seed API endpoint).

import { seedDatabase } from "../src/lib/seed"
import { db } from "../src/lib/db"

seedDatabase()
  .then((r) => {
    console.log("\nDemo credentials (password for all users): 0000")
    console.log("  admin / 0000  → Administrator")
    console.log("  manager01 / 0000 → Manager")
    console.log("  waiter01 / 0000 → Waiter")
    console.log("  waiter02 / 0000 → Waiter")
    console.log("  kitchen01 / 0000 → Kitchen Staff")
    console.log("  cashier01 / 0000 → Cashier")
    console.log(`\n(${r.roles} roles, ${r.users} users, ${r.tables} tables, ${r.orders} orders)`)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
