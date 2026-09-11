# ServeHub 1.0 — Server

## LAN Server Model

ServeHub operates as a LAN server, similar to a Minecraft LAN world:

```text
Restaurant Wi-Fi / LAN
        │
        ├── Windows PC (ServeHub Server + SQLite)
        │
        └── Android devices (Employee App)
```

No Internet connection is required for normal operations.

## Ports

| Port | Service |
|------|---------|
| 3000 | HTTP API + Web frontend (Next.js standalone) |
| 3003 | Realtime WebSocket (socket.io) |
| 3004 | Internal HTTP bridge (API → realtime) |

## mDNS Advertisement

The server advertises `_servehub._tcp.local.` with TXT records:

- `serverId` — stable installation identifier
- `name` — restaurant name
- `version` — ServeHub version
- `realtimePort` — realtime service port

Android clients use this for automatic discovery.

## Database

- **Engine**: SQLite via Prisma ORM
- **Location**: `%APPDATA%/com.servehub.app/db/custom.db` (Windows)
- **Schema**: applied from `db-template.db` on first launch
- **Migrations**: `prisma db push` at build time; no runtime migrations

## API Endpoints

All endpoints are under `/api/`. See `docs/api.md` for the full list.

## Security

- Argon2id password hashing
- Opaque session tokens (HttpOnly cookie or Bearer)
- Server-side permission enforcement on every route
- No client-trusted authorization flags
