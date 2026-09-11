// ServeHub — packaged single-process server entry (run by the bundled runtime).
//
// 1. Ensures the SQLite database exists: on first launch a pre-built template
//    (db-template.db, schema already applied at build time) is copied into
//    place so the server never starts against an empty file.
// 2. Starts the realtime mini-service (socket.io :3003 + bridge :3004).
// 3. Starts the Next.js standalone HTTP server (:3000).

const fs = require("fs")
const path = require("path")

function resolveDbPath() {
  const url = process.env.DATABASE_URL || "file:./db/custom.db"
  const rel = url.replace(/^file:/, "")
  return path.isAbsolute(rel) ? rel : path.resolve(__dirname, rel)
}

const dbPath = resolveDbPath()
const template = path.join(__dirname, "db-template.db")

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  if (fs.existsSync(template)) {
    fs.copyFileSync(template, dbPath)
    console.log(`[servehub] initialized database from template: ${dbPath}`)
  } else {
    console.warn("[servehub] no db-template.db found; server will start without schema")
  }
} else {
  console.log(`[servehub] using existing database: ${dbPath}`)
}

import("./realtime-service.js")
  .then(() => console.log("[servehub] realtime service started (3003/3004)"))
  .catch((e) => console.error("[servehub] realtime failed:", e))
  .finally(() => {
    // Next standalone server.js listens when required.
    require("./server.js")
  })
