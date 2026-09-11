# ServeHub — Security

ServeHub is designed for a trusted restaurant LAN. This page documents what is actually implemented and is honest about MVP gaps.

## Password hashing — Argon2id

`src/lib/auth.ts` hashes passwords with `@node-rs/argon2` (native Rust bindings):

```ts
hash(plain, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })
// algorithm 2 = Argon2id · 19 MiB memory · 2 iterations · 1 lane (OWASP-recommended baseline)
```

- Verification uses the encoded hash's embedded parameters; failures return `false` (never throw).
- Employees created via the API (`POST /api/employees`) and password resets (`PATCH /api/employees/[id]`) are hashed with the same routine.
- Login responses never distinguish "unknown user" from "wrong password" (`401 Credenciales inválidas`).

## Sessions

- Token: 32 random bytes hex-encoded (`randomBytes(32).toString("hex")` → 64 chars), stored in the `Session` table with `expiresAt = now + 12 h`.
- Transport: the login response returns the token in the JSON body **and** sets an `HttpOnly; SameSite=Lax; Path=/` cookie (`servehub_token`, `Max-Age=43200`). The frontend API client sends `Authorization: Bearer <token>`; the server reads the cookie first, then the bearer header.
- Validation: every request resolves `Session → User` (`getUserFromToken`); expired sessions are deleted on access; **inactive users (`active=false`) are rejected** even with a valid session.
- Logout (`POST /api/auth/logout`) deletes the session row and clears the cookie; the client also removes its localStorage copy.

## Server-side authorization

- Every handler resolves the user and checks a specific permission with `hasPermission` (`src/lib/authz.ts`) before touching the database — the client-side nav filtering is convenience, **not** the security boundary.
- Order transitions are double-gated: the state machine edge (`canTransition`) and the per-edge permission (`TRANSITION_PERMISSIONS`) — see [orders.md](orders.md).
- Ownership scoping: chat endpoints verify participation; notification PATCHes are filtered by `userId`; notifications/attendance/settings only expose the caller's own rows where applicable.

## SQL injection — Prisma

All database access goes through Prisma Client with typed, parameterized queries (`findUnique`, `findMany({ where })`, `update`, `upsert`, …). There is no raw SQL anywhere in the codebase (`db.execute`/`$queryRaw` are unused), so classic SQL injection is structurally prevented.

## Audit log

Mutating endpoints append to `AuditLog` (`userId`, `action`, `entity`, `entityId`, `details`):

| Action | Trigger |
|---|---|
| `LOGIN` | successful login |
| `ORDER_CREATE`, `ORDER_<TO>` (e.g. `ORDER_READY`) | order create/transition (`details` stores `"from->to"`) |
| `TABLE_CREATE` / `TABLE_UPDATE` / `TABLE_DELETE` | tables API |
| `EMPLOYEE_CREATE` / `EMPLOYEE_UPDATE` / `EMPLOYEE_DISABLE` | employees API |
| `ROLE_UPDATE` | role permission changes |
| `COMPLAINT_CREATE` / `COMPLAINT_UPDATE`, `CS_CREATE` | complaints / customer service |
| `SETTINGS_UPDATE` | settings changes |

There is no UI over the audit log in the MVP; it is queryable directly in SQLite.

## Demo credentials — change before real use

The seed creates `admin`, `manager01`, `waiter01`, `waiter02`, `kitchen01`, `cashier01` all with password **`0000`**, and the login screen openly displays them ("Contraseña para todos: 0000"). This is intentional for the demo. **Before any real deployment:** re-seed with real passwords or change every password via `PATCH /api/employees/[id]`, then remove the demo hint from the login screen (`login.demo*` keys in `src/lib/i18n.ts`). See [development.md](development.md).

## Deployment hardening notes

- Terminate TLS at Caddy (or any reverse proxy) — the app serves plain HTTP; the bundled `Caddyfile` listens on `:81` without TLS. See [deployment.md](deployment.md).
- Bind the realtime bridge (`:3004`) to localhost only; it has no authentication and accepts arbitrary broadcast events from anyone who can reach it (`Access-Control-Allow-Origin: *`).
- The socket.io server (`:3003`) also allows any origin. Behind the Caddy gateway this is acceptable on a home/restaurant LAN; do not expose these ports to the internet.

## Known MVP limitations (honest list)

1. **No rate limiting / lockout** — login can be brute-forced without throttling.
2. **No CSRF protection beyond `SameSite=Lax`** — the cookie path is low-risk for JSON APIs, but there are no CSRF tokens.
3. **Token in `localStorage`** — the bearer token is stored client-side in `localStorage` (`servehub_token`), which is readable by any XSS payload. The HttpOnly cookie exists in parallel, but the SPA primarily uses the bearer header.
4. **Role edits don't affect server enforcement** — `PATCH /api/roles/[id]` persists permissions, but per-request checks read the built-in `ROLE_PERMISSIONS` constant (see caveat in [roles-and-permissions.md](roles-and-permissions.md)).
5. **Sessions are not revoked on password change** — changing a user's password does not delete their existing `Session` rows (only disabling the user blocks them).
6. **No audit viewer, no log retention policy**, `AuditLog.ip` is never populated.
7. **Realtime is unauthenticated** — sockets subscribe with a client-supplied `userId` (`servehub:subscribe`); a malicious client could join another user's room to receive their notification toasts. No sensitive data is included in the payloads (titles/bodies only).
8. **No input validation library** — handlers do manual checks (`JSON inválido`, required fields, enum membership for table statuses); lengths are unbounded. Zod is available in `package.json` but unused by routes.
9. **`typescript.ignoreBuildErrors: true`** in `next.config.ts` — the production build skips type errors.
10. **CORS `*`** on the realtime service; the Next.js API itself has no CORS headers (same-origin behind Caddy).
