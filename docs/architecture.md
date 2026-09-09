# ServeHub — Architecture

ServeHub is a restaurant operations platform (orders, tables, staff, chat, complaints, attendance) delivered as a **web-first MVP**. The original specification asked for a React+Vite+Tauri+Rust(Axum)+SQLx stack; this implementation adapts the same feature set to a **Next.js 16 App Router** application with a small **socket.io realtime mini-service**, which runs in any browser on the restaurant LAN. See [tauri.md](tauri.md) for the desktop/Android packaging roadmap.

## Stack at a glance

| Layer | Spec (original) | Implementation (actual) |
|---|---|---|
| Frontend | React + Vite SPA | Next.js 16 App Router, single `/` route, client-side view switching |
| API server | Rust + Axum | Next.js Route Handlers (`src/app/api/**`) |
| Database | SQLite via SQLx | SQLite via Prisma (`db/custom.db`) |
| Realtime | Rust WebSocket server | socket.io mini-service (`mini-services/realtime`, port 3003) + HTTP bridge (port 3004) |
| Desktop/Android | Tauri 2 shell | Browser-first MVP; Tauri 2 documented as roadmap ([tauri.md](tauri.md)) |
| Auth | — | Argon2id password hashing + bearer/cookie sessions ([security.md](security.md)) |
| Gateway | — | Caddy (`Caddyfile`) on `:81`, proxies to `:3000` and `:3003` |

## Overview diagram

```
                 ┌─────────────────────────────────────────────────┐
                 │            Browsers on the LAN                  │
                 │   desktop (≥1024px)         mobile (<1024px)    │
                 └──────────┬──────────────────────────┬──────────┘
                            │ http://<host>:81         │ ws + http
                 ┌──────────▼──────────────────────────▼──────────┐
                 │            Caddy gateway  (Caddyfile, :81)     │
                 │   default            → localhost:3000          │
                 │   ?XTransformPort=N  → localhost:{N}           │
                 └──────────┬──────────────────────────┬──────────┘
                            │                          │
        ┌───────────────────▼─────────────┐   ┌────────▼──────────────────────┐
        │  Next.js server (port 3000)     │   │  Realtime mini-service        │
        │  · one user-visible route "/"   │   │  mini-services/realtime       │
        │  · REST API  /api/**            │───┼──▶ socket.io server  :3003    │
        │  · Argon2 auth + sessions       │   │  (path "/")                   │
        │  · Prisma client                │   │  HTTP bridge         :3004    │
        └───────────────────┬─────────────┘   └────────┬──────────────────────┘
                            │                          │ broadcast
                 ┌──────────▼──────────┐    servehub:event / servehub:notify
                 │  SQLite             │               ▼
                 │  db/custom.db       │        subscribed clients
                 └─────────────────────┘        (room user:<id>)
```

Ports: **81** Caddy gateway · **3000** Next.js · **3003** socket.io · **3004** internal HTTP bridge (localhost only).

## Request flow

1. **Boot** — `src/app/page.tsx` mounts, the Zustand store (`src/lib/store.ts`) runs `boot()`:
   - `GET /api/config` (public) loads the restaurant JSON config + row counts → drives branding, feature flags, nav modules ([configuration.md](configuration.md)).
   - `GET /api/auth/me` restores an existing session from the token in `localStorage` (`servehub_token`) or the `servehub_token` cookie.
2. **Splash → Login** — a splash screen shows for ≥ 2.2 s; unauthenticated users get the login screen. Admin logins are held behind a 10-second warning ("Cuidado con lo que haces") before the session commits.
3. **View switching** — after login the shell renders one of 11 views purely client-side. There is **no client-side router**: `useApp(s => s.view)` (Zustand `ViewKey`) picks the view component. Views are permission- and feature-filtered in the nav.
4. **Data access** — views call the typed client `src/lib/api-client.ts`, which always sends `Authorization: Bearer <token>` (and `credentials: "include"`). Every API handler re-validates auth + permission server-side ([roles-and-permissions.md](roles-and-permissions.md)).

## Realtime flow

```
API route ──emitRealtime()──▶ POST http://localhost:3004/bridge ──▶ socket.io broadcast
                                                                    ├── servehub:event   → all clients
                                                                    └── servehub:notify  → room user:<userId>
Client (browser): io("/?XTransformPort=3003") ──▶ Caddy ──▶ socket.io :3003
```

- `src/lib/realtime.ts` — `emitRealtime(event)`: fire-and-forget HTTP POST to the bridge; failures are swallowed so API responses never depend on realtime being up.
- `mini-services/realtime/index.ts` — one process, two listeners: socket.io on **3003** (path `"/"`; it intercepts all HTTP on its port, hence the separate bridge port) and the bridge HTTP server on **3004** (`POST /bridge`, `GET /health`).
- `src/lib/use-realtime.ts` — a **singleton socket manager**: one shared socket per authenticated user, listener ref-counting per view, `servehub:subscribe {userId}` joins the personal room, logout releases the socket.
- Event catalog: `order.created`, `order.updated`, `order.ready`, `order.delivered`, `message.created`, `notification.created` ([orders.md](orders.md)).

## Why the stack was adapted

The sandbox provides Node/Bun, Next.js and SQLite — no Rust/Android/Windows toolchains. The adaptation preserves every functional requirement (workflow state machine, RBAC, realtime, JSON-driven config, i18n, responsive shell) while replacing the transport layer: Next.js Route Handlers replace Axum endpoints 1:1, Prisma replaces SQLx with the same single-file SQLite database, and a socket.io mini-service replaces the Rust WebSocket server. All docs describe the **actual** implementation; [tauri.md](tauri.md) explains how the Tauri 2 goal is still reached.

## Module map

```
src/
├── app/
│   ├── page.tsx                  # the single route: splash → login → shell + view switch
│   ├── layout.tsx                # fonts, toaster, global CSS
│   └── api/                      # REST API (see api.md)
│       ├── config/ health/
│       ├── auth/{login,logout,me}/
│       ├── orders/ ([id]/, [id]/transition/)
│       ├── tables/ [id]/ · employees/ [id]/ · roles/ [id]/
│       ├── complaints/ [id]/ · customer-service/ [id]/
│       ├── chat/{conversations, messages}/ · chat/conversations/[id]/messages/
│       ├── attendance/ · notifications/ [id]/ · settings/ · developer/
├── components/
│   ├── splash-screen.tsx         # animated boot splash
│   ├── login-screen.tsx          # login + admin 10s warning gate
│   ├── branding-injector.tsx     # config → CSS vars (--brand, --primary, …) + title
│   ├── responsive-shell.tsx      # sidebar (lg+) / header + bottom nav (<lg), F10 dev keybind
│   ├── views/                    # one component per ViewKey + developer-panel + mobile-preview-frame
│   └── ui/                       # shadcn/ui primitives
├── lib/
│   ├── store.ts                  # Zustand app store: boot, auth, locale, view, devMode
│   ├── api-client.ts             # typed fetch client (bearer token)
│   ├── i18n.ts                   # es/en dictionaries + TranslationKey type
│   ├── config.ts                 # ServeHubConfig type + Café Sakura defaults
│   ├── permissions.ts            # permission catalog + default role sets
│   ├── authz.ts                  # effective permissions / hasPermission
│   ├── auth.ts                   # Argon2 hashing, session CRUD, token extraction
│   ├── order-state.ts            # order state machine + transition permissions
│   ├── realtime.ts               # emitRealtime → bridge
│   ├── use-realtime.ts           # singleton socket.io hook
│   ├── use-permissions.ts        # client-side can()/isAdmin/isDeveloper
│   ├── db.ts                     # Prisma singleton
│   └── types.ts                  # shared frontend types
mini-services/realtime/index.ts   # socket.io :3003 + bridge :3004
prisma/schema.prisma              # 16 models (see database.md)
scripts/seed.ts                   # demo data seeding (see development.md)
Caddyfile                         # :81 gateway with XTransformPort routing
```

## Cross references

- API details: [api.md](api.md) · Database: [database.md](database.md)
- Roles/permissions: [roles-and-permissions.md](roles-and-permissions.md) · Order workflow: [orders.md](orders.md)
- Config & feature flags: [configuration.md](configuration.md) · i18n: [localization.md](localization.md)
- Responsive behavior: [responsive-design.md](responsive-design.md) · Security: [security.md](security.md)
- Running locally: [development.md](development.md) · Deploying: [deployment.md](deployment.md) · Tauri roadmap: [tauri.md](tauri.md)
