# ServeHub — Deployment

ServeHub is deployed as a **single-server, LAN-first system**: one restaurant PC runs the web stack, every device (terminals, kitchen screen, phones) points at it through one URL. Desktop/Android shells are optional thin clients — see [tauri.md](tauri.md).

## Topology & ports

```
Devices (LAN)  ──▶  Caddy :81  ──┬─ default           ──▶ Next.js :3000   (REST + SPA)
                                 └─ ?XTransformPort=N ──▶ localhost:N    (realtime: N=3003)

Restaurant PC processes:
  1. Caddy gateway            :81   (Caddyfile)
  2. Next.js standalone server :3000 (.next/standalone/server.js)
  3. Realtime mini-service     :3003 socket.io (path "/") + :3004 bridge (localhost)
  4. SQLite file               db/custom.db
```

The mini-service's bridge port (3004) is internal — Next.js API routes POST events to `http://localhost:3004/bridge`. Never expose 3000/3003/3004 beyond the gateway; point clients at **:81 only**.

## Production build

```bash
bun install
bun run db:push                 # sync prisma/schema.prisma → db/custom.db
bun run scripts/seed.ts         # first deploy only (demo data) — see warning below
bun run build                   # next build (output: "standalone") + copies static/public
bun run start                   # NODE_ENV=production bun .next/standalone/server.js
```

- `next.config.ts` sets `output: "standalone"`, and the `build` script copies `.next/static` and `public/` into `.next/standalone/` so the server is self-contained.
- `bun run start` tees logs to `server.log` (dev logs go to `dev.log`).
- The realtime service is **not** built — run it directly: `cd mini-services/realtime && bun run dev` (or `bun index.ts` in production; it is tiny and stable).

## Environment variables

| Variable | Example | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `file:/opt/servehub/db/custom.db` | ✅ | SQLite file location (`.env` at repo root; Prisma reads it) |
| `NODE_ENV` | `production` | (set by `start`) | Standalone server mode |
| `PORT` | `3000` | — | The standalone server honors `PORT`; the `start` script keeps the default 3000 |

No other secrets are required: passwords are stored as Argon2 hashes, sessions live in SQLite ([security.md](security.md)).

## Caddy gateway

The bundled `Caddyfile` (port **81**) does two things:

```caddyfile
:81 {
    @transform_port_query { query XTransformPort=* }
    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort} { header_up Host {host} … }
    }
    handle {
        reverse_proxy localhost:3000 { header_up Host {host} … }
    }
}
```

Default traffic reaches Next.js; any URL with `?XTransformPort=3003` is proxied to that port — this is how the browser's socket.io client (`io("/?XTransformPort=3003")`) crosses the single gateway. For real deployments:

- Replace `:81` with your site address and enable TLS (`caddy` will fetch/provision certificates automatically) — ServeHub serves plain HTTP by itself.
- If you serve on standard ports, the realtime client URL in `src/lib/use-realtime.ts` stays the same (`io("/?XTransformPort=3003")`), since it is relative to the page origin.

## Process supervision (systemd example)

```ini
# /etc/systemd/system/servehub-web.service
[Unit]
Description=ServeHub web (Next.js standalone)
After=network.target

[Service]
WorkingDirectory=/opt/servehub
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:/opt/servehub/db/custom.db
ExecStart=/usr/local/bin/bun .next/standalone/server.js
Restart=always

[Install]
WantedBy=multi-user.target

# /etc/systemd/system/servehub-realtime.service
[Unit]
Description=ServeHub realtime (socket.io :3003 + bridge :3004)
After=network.target

[Service]
WorkingDirectory=/opt/servehub/mini-services/realtime
ExecStart=/usr/local/bin/bun index.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

Start with `systemctl enable --now servehub-web servehub-realtime`. Caddy runs as its own service (`caddy run --config Caddyfile`). Health check: `curl http://localhost:3000/api/health` → `{"web":"ok","database":"ok","realtime":"ok"}`.

## First-deployment checklist

1. ☐ Static LAN IP / hostname for the server PC; reserve it in DHCP.
2. ☐ Install Bun (or Node 18+), deploy the repo, `bun install`.
3. ☐ `.env` with `DATABASE_URL` pointing to a persistent path (back it up!).
4. ☐ `bun run db:push` → `bun run scripts/seed.ts` **only for demos**; for production, create your own admin via seed then immediately change every password (seed users all use `0000` — [security.md](security.md)).
5. ☐ `bun run build` + services configured (above) + realtime service running.
6. ☐ Caddy TLS + firewall: allow only :81 (or :443) inbound; keep 3000/3003/3004 LAN-internal.
7. ☐ Verify `GET /api/health` shows web/database/realtime all `ok`; log in, send a test order from a second device, confirm the kitchen device gets the realtime toast ([orders.md](orders.md)).
8. ☐ Configure `src/lib/config.ts` for the real restaurant ([configuration.md](configuration.md)).
9. ☐ Backups: copy `db/custom.db` while the server is stopped (or use SQLite's backup API) — it is the entire system state.
10. ☐ Optional: Tauri shells for terminals/phones ([tauri.md](tauri.md)).

## Scaling notes (MVP boundaries)

- One SQLite file + one Next.js process + one realtime process = one server. This comfortably handles a restaurant's worth of traffic (tens of concurrent staff devices).
- Horizontal scaling, Postgres migration (`provider = "postgresql"` in `prisma/schema.prisma`) and a Redis-backed socket.io adapter are all straightforward follow-ups but are out of scope for the MVP.
