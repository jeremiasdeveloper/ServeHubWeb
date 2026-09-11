#!/usr/bin/env bash
# ServeHub — Windows package assembly
#
# Produces src-tauri/resources/server/ containing:
#   - Next.js standalone build (server.js + node_modules + .next + public)
#   - realtime-service.js (bundled realtime mini-service)
#   - servehub-entry.js    (single-process entry)
#   - db-template.db       (empty database with schema applied; copied on first run)
#   - servehub-runtime.exe (bun runtime, renamed copy)
# The Tauri build then packs this into the NSIS installer / portable exe.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building Next.js standalone"
bun run build
rm -f .next/standalone/.env

echo "==> Preparing desktop boot screen"
# Desktop window loads this local page first and waits for the embedded
# server to answer /api/health before navigating to http://localhost:3000.
rm -rf out
mkdir -p out
cp packaging/boot.html out/boot.html

echo "==> Bundling realtime service"
bun build --target=bun mini-services/realtime/index.ts --outfile .next/standalone/realtime-service.js

echo "==> Building database template (schema only)"
rm -f .next/standalone/db-template.db prisma/db-template.db
DATABASE_URL="file:db-template.db" bunx prisma db push --skip-generate >/dev/null
mv prisma/db-template.db .next/standalone/db-template.db

echo "==> Copying entry"
cp packaging/servehub-entry.js .next/standalone/servehub-entry.js

echo "==> Copying runtime (bun)"
RES=src-tauri/resources/server
rm -rf "$RES"
mkdir -p "$RES"
cp -r .next/standalone/. "$RES/"
cp "$(command -v bun)" "$RES/servehub-runtime.exe"

echo "==> Windows server resources ready at $RES"
