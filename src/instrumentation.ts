// Next.js instrumentation hook — runs once when the server process starts.
// ServeHub uses it to guarantee that roles and users exist in the database
// before the first request arrives (see src/lib/bootstrap.ts).

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { ensureUsersInitialized } = await import("@/lib/bootstrap")
  await ensureUsersInitialized()
}
