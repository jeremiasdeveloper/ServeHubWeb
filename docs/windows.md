# ServeHub 1.0 — Windows Application

## Overview

The Windows application is the restaurant's authoritative server and
administration environment. It packages:

- **Next.js standalone server** (port 3000) — REST API + web frontend
- **Realtime service** (socket.io port 3003, HTTP bridge port 3004)
- **SQLite database** — persisted in `%APPDATA%/com.servehub.app/db/`
- **mDNS advertisement** — `_servehub._tcp` for Android discovery

## Architecture

```text
ServeHub.exe (Tauri 2 shell)
  ├── spawns: servehub-runtime.exe (Bun)
  │     ├── servehub-entry.js
  │     │     ├── realtime-service.js (socket.io :3003, bridge :3004)
  │     │     └── server.js (Next.js standalone :3000)
  │     └── db/custom.db (SQLite)
  └── WebView2 → http://localhost:3000
```

## Server Mode

The server starts automatically when the application launches. It:

1. Copies `db-template.db` to the data directory on first run.
2. Boots the realtime service and Next.js server.
3. Waits for health, then advertises via mDNS.

The server binds to `0.0.0.0:3000`, making it reachable from Android
devices on the same LAN.

## Server Identity

Each installation has a stable Server ID (e.g. `SH-CF9A-8X21`) persisted
in `restaurant_settings`. It is included in `/api/config` responses and
mDNS TXT records.

## Requirements

- Windows 10/11 x64
- WebView2 Runtime (auto-installed by the NSIS installer if missing)
- No Node.js, npm, or development tools required
