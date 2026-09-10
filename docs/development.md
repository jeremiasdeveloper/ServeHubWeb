# ServeHub — Development Guide

Everything you need to run ServeHub locally.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Bun | 1.x (recommended) | Runs dev server, seed and the realtime mini-service. Node 18+ works for `next dev` too. |
| Node | 18+ (if not using Bun) | Next.js 16 requirement. |
| SQLite | bundled via Prisma | No database server needed. |

## Setup

```bash
# 1. Install dependencies
bun install                        # or: npm install

# 2. Environment — .env at the repo root
#    DATABASE_URL=file:/home/z/my-project/db/custom.db
#    (any absolute/relative path ending in .db works)

# 3. Create the schema and generate the Prisma client
bun run db:push                    # prisma db push --accept-data-loss

# 4. Seed demo data (roles, users, tables, orders, chat, …)
bun run scripts/seed.ts

# 5. Start the realtime mini-service (socket.io :3003 + bridge :3004)
cd mini-services/realtime && bun run dev     # bun --hot index.ts

# 6. Start the web app (another terminal, repo root)
bun run dev                        # next dev -p 3000
```

Open **http://localhost:3000** (or http://localhost:81 if you run Caddy — see [deployment.md](deployment.md)).

### Demo credentials

Password for every demo user: **`0000`**

| Username | Role |
|---|---|
| `admin` | Administrator |
| `manager01` | Manager |
| `waiter01` / `waiter02` | Waiter |
| `kitchen01` | Kitchen Staff |
| `cashier01` | Cashier |

The seed also creates 12 tables (`01`–`12`, Salón principal / Terraza), 5 orders (#1041–#1045 in mixed statuses), the group conversation **Chat general** (5 participants, 5 messages), 3 complaints, 3 customer-service requests, today's attendance and 4 notifications. Re-running the seed is idempotent for roles/users/tables (upserts) but **deletes and recreates all orders** (with their items and history).

## npm scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 3000` (logs teed to `dev.log`) | Web app in dev mode. |
| `build` | `next build` + copy `static`/`public` into `.next/standalone/` | Production standalone build. |
| `start` | `bun .next/standalone/server.js` | Serve the production build (`NODE_ENV=production`, logs to `server.log`). |
| `lint` | `eslint .` | Lint (passes clean on the current codebase). |
| `db:push` | `prisma db push --accept-data-loss` | Sync `prisma/schema.prisma` to SQLite. |
| `db:generate` | `prisma generate` | Regenerate the Prisma client after schema changes. |
| `db:migrate` / `db:reset` | `prisma migrate dev` / `reset` | Migration workflow (MVP uses `db:push` instead). |

The realtime service has its own script: `mini-services/realtime/package.json` → `bun run dev` (`bun --hot index.ts`).

## Project structure

```
├── Caddyfile                     # :81 gateway (default→3000, ?XTransformPort=N→N)
├── db/custom.db                  # SQLite database file
├── prisma/schema.prisma          # 16 models — see docs/database.md
├── scripts/seed.ts               # demo data seeder
├── mini-services/realtime/
│   ├── index.ts                  # socket.io :3003 (path "/") + HTTP bridge :3004
│   └── package.json
└── src/
    ├── app/
    │   ├── page.tsx              # single route: splash → login → shell + view switch
    │   ├── layout.tsx            # fonts, toaster, globals.css
    │   └── api/**                # REST handlers — see docs/api.md
    ├── components/
    │   ├── splash-screen.tsx / login-screen.tsx / branding-injector.tsx
    │   ├── responsive-shell.tsx  # sidebar / bottom nav / F10 dev keybind
    │   ├── views/                # dashboard, orders, tables, employees, roles,
    │   │                         # complaints, customer-service, chat, attendance,
    │   │                         # notifications, settings, developer-panel,
    │   │                         # mobile-preview-frame, primitives
    │   └── ui/                   # shadcn/ui primitives
    ├── lib/                      # store, api-client, i18n, config, permissions,
    │                             # authz, auth, order-state, realtime, use-realtime,
    │                             # use-permissions, db, types, utils
    └── hooks/use-mobile.ts       # useIsMobile (768px breakpoint)
```

## Daily workflow

- **Schema change** → edit `prisma/schema.prisma` → `bun run db:generate && bun run db:push`.
- **New API route** → add `src/app/api/<resource>/route.ts`; start from `resolveUser`/`hasPermission` in `src/lib/api.ts` + `src/lib/authz.ts`. Always enforce permissions server-side (see [security.md](security.md)).
- **New view** → create `src/components/views/<name>-view.tsx`, register it in the `renderView` switch in `src/app/page.tsx`, add a `NAV_ITEMS` entry (permission + optional feature flag) in `src/components/responsive-shell.tsx`, add a `ViewKey` in `src/lib/store.ts`, and add i18n keys to both dictionaries.
- **New realtime event** → extend the `RealtimeEvent` union in `src/lib/realtime.ts` and consume it via `useRealtime`.

## Developer mode (F10)

Press **F10** in the app (desktop) to open the developer panel — gated by the `developer.access` permission, which only the Administrator role holds by default. It shows: mobile preview toggle (390×844 frame), config preview, server/realtime/database status, per-table record counts and role permission sets. The "re-seed" button is a reminder to run `bun run scripts/seed.ts`; there is no HTTP re-seed endpoint.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `realtime: "offline"` in `/api/health` | The mini-service isn't running. Start `mini-services/realtime` (`bun run dev`). API routes still work without it (events are dropped silently). |
| Sockets don't connect through Caddy | Client must use `io("/?XTransformPort=3003")`; check the `@transform_port_query` block in the `Caddyfile`. Direct connections (no Caddy) need the same query param or port 3003. |
| Login returns 401 for `admin` | Database not seeded (`bun run scripts/seed.ts`) or `DATABASE_URL` points to another file. |
| `@prisma/client did not initialize yet` | Run `bun run db:generate` after editing the schema. |
| Nav item missing | Either the role lacks the permission (see [roles-and-permissions.md](roles-and-permissions.md)) or the feature flag is off in [configuration.md](configuration.md). |
| Port 3000 busy | `next dev` pins port 3000 (`-p 3000`); free the port or adjust the script. |
| Notifications badge stuck | Badge polls `GET /api/notifications?unread=1` every 15 s; realtime toasts need the mini-service up. |

## Related docs

[architecture.md](architecture.md) · [api.md](api.md) · [database.md](database.md) · [configuration.md](configuration.md) · [deployment.md](deployment.md)
