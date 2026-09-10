// ServeHub — Realtime mini-service
// Two listeners in one process:
//   - Port 3003: socket.io server with path "/" (clients connect via Caddy: io("/?XTransformPort=3003"))
//   - Port 3004: internal HTTP bridge (Next.js API routes POST events here)
//
// socket.io with path:"/" intercepts all HTTP requests on its port, so the
// bridge must live on a separate port.

import { createServer } from "http"
import { Server } from "socket.io"

const IO_PORT = 3003
const BRIDGE_PORT = 3004

const io = new Server({
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on("connection", (socket) => {
  console.log(`[realtime] client connected: ${socket.id}`)

  socket.on("servehub:subscribe", (payload: { userId?: string }) => {
    if (payload?.userId) socket.join(`user:${payload.userId}`)
  })

  socket.on("servehub:ping", (cb: () => void) => {
    if (typeof cb === "function") cb()
  })

  socket.on("disconnect", (reason) => {
    console.log(`[realtime] client disconnected: ${socket.id} (${reason})`)
  })

  socket.on("error", (err) => {
    console.error(`[realtime] socket error (${socket.id}):`, err)
  })
})

// --- Bridge HTTP server (port 3004) -------------------------------------------
// API routes POST events here; we re-broadcast to all socket.io clients.
const bridgeServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, service: "servehub-realtime", clients: io.engine.clientsCount }))
    return
  }
  if (req.method === "POST" && req.url === "/bridge") {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      try {
        const event = JSON.parse(body)
        io.emit("servehub:event", event)
        if (event.type === "notification.created" && event.userId) {
          io.to(`user:${event.userId}`).emit("servehub:notify", event)
        }
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount }))
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "invalid json" }))
      }
    })
    return
  }
  res.writeHead(404, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: "not found" }))
})

io.attach(IO_PORT, { path: "/" })
bridgeServer.listen(BRIDGE_PORT, () => {
  console.log(`[servehub-realtime] socket.io on :${IO_PORT}, bridge on :${BRIDGE_PORT}`)
})

process.on("SIGTERM", () => {
  console.log("[servehub-realtime] SIGTERM, shutting down...")
  io.close()
  bridgeServer.close(() => process.exit(0))
})
process.on("SIGINT", () => {
  console.log("[servehub-realtime] SIGINT, shutting down...")
  io.close()
  bridgeServer.close(() => process.exit(0))
})
