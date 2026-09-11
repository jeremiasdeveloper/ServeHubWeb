// ServeHub — Tauri bridge
// Thin, optional wrapper around Tauri's invoke(). On the web build (or inside
// a plain browser) there is no Tauri runtime, so every helper degrades to a
// safe fallback instead of crashing.

export interface DiscoveredServer {
  name: string
  serverId: string
  host: string
  port: number
  realtimePort: number
}

function tauriInvokeAvailable(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
      (window as unknown as { __TAURI__?: unknown }).__TAURI__
  )
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!tauriInvokeAvailable()) throw new Error("tauri-unavailable")
  const mod = await import("@tauri-apps/api/core")
  return mod.invoke<T>(cmd, args)
}

// mDNS/DNS-SD discovery of _servehub._tcp services on the local network.
// Implemented natively in the Tauri shell (mdns-sd crate); on the web this
// rejects with "tauri-unavailable" and the UI falls back to manual entry.
export async function discoverServers(timeoutMs = 4000): Promise<DiscoveredServer[]> {
  try {
    const servers = await invoke<DiscoveredServer[]>("discover_servers", { timeoutMs })
    return Array.isArray(servers) ? servers : []
  } catch {
    return []
  }
}

export function isTauri(): boolean {
  return tauriInvokeAvailable()
}
