// ServeHub — server connection management (Android / remote clients)
//
// On the web build the app is served by the same server it talks to, so the
// base URL is same-origin (""). Packaged clients (Android) run the frontend
// locally and must connect to a specific ServeHub restaurant server over the
// LAN. The active connection is persisted in localStorage and validated
// against the server's identity (serverId) before use.

import type { ServerConnection, ServeHubConfig } from "./types"

const CONNECTION_KEY = "servehub_connection"

export function isEmbeddedClient(): boolean {
  if (typeof window === "undefined") return false
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

export function getSavedConnection(): ServerConnection | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CONNECTION_KEY)
    return raw ? (JSON.parse(raw) as ServerConnection) : null
  } catch {
    return null
  }
}

export function setSavedConnection(conn: ServerConnection) {
  window.localStorage.setItem(CONNECTION_KEY, JSON.stringify(conn))
}

export function clearSavedConnection() {
  window.localStorage.removeItem(CONNECTION_KEY)
}

// Base URL prefix for every API call and the realtime socket.
// "" on the web build; "http://192.168.1.20:3000" on Android.
export function getApiBase(): string {
  const conn = getSavedConnection()
  return conn?.baseUrl?.replace(/\/+$/, "") ?? ""
}

// Realtime endpoint: same host as the API, on the configured realtime port.
export function getRealtimeUrl(): string {
  const conn = getSavedConnection()
  if (!conn) return "/" // same-origin through the proxy
  try {
    const u = new URL(conn.baseUrl)
    // The realtime service port is advertised by the server config.
    const port = Number(window.localStorage.getItem("servehub_realtime_port") || "3003")
    return `${u.protocol}//${u.hostname}:${port}`
  } catch {
    return "/"
  }
}

export function storeRealtimePort(port: number) {
  window.localStorage.setItem("servehub_realtime_port", String(port))
}

// The Windows desktop shell injects this so the app auto-connects to its
// own embedded server without showing the connection screen.
export function getDesktopServerUrl(): string | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { __SERVEHUB_DESKTOP_SERVER__?: string }).__SERVEHUB_DESKTOP_SERVER__ ?? null
}

// Verify the desktop shell's embedded server and save the connection once
// it answers /api/config. Retries while the server process boots.
export async function ensureDesktopConnection(timeoutMs = 45000): Promise<boolean> {
  const base = getDesktopServerUrl()
  if (!base) return false
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${base}/api/config`, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        const cfg = (await res.json()) as ServeHubConfig & { serverId?: string }
        setSavedConnection({
          baseUrl: base,
          serverId: cfg.serverId ?? "local",
          restaurantName: cfg.restaurant?.name ?? "ServeHub",
          savedAt: new Date().toISOString(),
        })
        if (cfg.server?.realtimePort) storeRealtimePort(cfg.server.realtimePort)
        return true
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}
