# ServeHub 1.0 — Deployment

ServeHub is deployed as a **single-server, LAN-first system**: the restaurant PC runs the full stack and Android employees connect over the local network. Internet is not required for normal operation.

## Production deployment (Windows installer)

The primary deployment target is the NSIS installer:

```bash
bash packaging/build-windows-package.sh   # assembles src-tauri/resources/server/
bunx tauri build                          # produces the NSIS installer
```

The installer packages:

- Tauri shell (WebView2 + Rust runtime, mDNS advertisement)
- Bun runtime (`servehub-runtime.exe`)
- Next.js standalone server + bundled realtime service (single process)
- Database template (`db-template.db`, copied to the app data dir on first launch)

After installing, launching ServeHub starts the restaurant server automatically on `0.0.0.0:3000` (API + web) and `:3003` (socket.io), and advertises `_servehub._tcp` via mDNS.

## Web-only deployment

```bash
bun install
bunx prisma db push
bun run build
PORT=3000 HOSTNAME=0.0.0.0 bun run start
```

The standalone server is self-contained (`.next/standalone` includes static assets and `public/`). The Caddy gateway (`Caddyfile`, port 81) remains available as an optional reverse proxy that routes `?XTransformPort=3003` to the realtime service.

## Android deployment

1. Build the static frontend: `SERVEHUB_EXPORT=1 bunx next build` (API routes are excluded from the export build).
2. Scaffold once: `bunx tauri android init` (requires `ANDROID_HOME`/`NDK_HOME`).
3. Build: `bunx tauri android build` or Gradle `assembleArm64Release`.
4. Sign: `apksigner sign --ks servehub.p12 --ks-pass pass:... --out ServeHub.apk app-arm64-release-unsigned.apk`
5. Distribute the APK to employee devices. Cleartext HTTP is enabled because the server is reached over the LAN.

## Ports

| Port | Service |
|------|---------|
| 3000 | Next.js standalone (REST API + frontend), bound to `0.0.0.0` |
| 3003 | socket.io realtime |
| 3004 | internal HTTP bridge (localhost only) |
| 81   | optional Caddy gateway (dev/web topology) |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:../db/custom.db` | SQLite location (relative to `prisma/`) |
| `PORT` | `3000` | HTTP server port |
| `HOSTNAME` | `0.0.0.0` | bind address |
| `NODE_ENV` | `production` | runtime environment |

In the packaged Windows app the database lives in `%APPDATA%/com.servehub.app/db/custom.db` and these variables are set by the shell.

## Database safety

- Schema changes go through `prisma db push` / migrations at build time — never `--accept-data-loss` in production.
- The database persists across restarts and updates; first launch initializes it from the bundled template.
- Backups: Settings → Backup (download/restore), see [backup.md](backup.md).