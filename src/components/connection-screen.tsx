"use client"

// ServeHub — server connection screen (packaged Android / remote clients)
// Discovers ServeHub restaurant servers on the local LAN via mDNS
// (_servehub._tcp) with a manual IP:port fallback. Once a server answers
// /api/config, its identity is validated and saved.

import { useCallback, useEffect, useRef, useState } from "react"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw, Search, Server, UtensilsCrossed, Wifi, WifiOff } from "lucide-react"
import { discoverServers, isTauri, type DiscoveredServer } from "@/lib/tauri"
import { setSavedConnection, storeRealtimePort } from "@/lib/connection"
import type { ServeHubConfig } from "@/lib/types"

interface VerifiedServer extends DiscoveredServer {
  restaurantName: string
}

async function verifyServer(host: string, port: number, realtimePort: number, name?: string): Promise<VerifiedServer | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`http://${host}:${port}/api/config`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const cfg = (await res.json()) as ServeHubConfig
    if (!cfg?.serverId) return null
    if (realtimePort > 0) storeRealtimePort(cfg.server.realtimePort || realtimePort)
    return {
      name: name || cfg.restaurant.name,
      serverId: cfg.serverId,
      restaurantName: cfg.restaurant.name || name || "ServeHub",
      host,
      port,
      realtimePort: cfg.server.realtimePort || realtimePort,
    }
  } catch {
    return null
  }
}

export function ConnectionScreen({ onConnected }: { onConnected: () => void }) {
  const t = useApp((s) => s.t)
  const [searching, setSearching] = useState(true)
  const [servers, setServers] = useState<VerifiedServer[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [host, setHost] = useState("")
  const [port, setPort] = useState("3000")
  const [manualError, setManualError] = useState<string | null>(null)
  const discoveryDone = useRef(false)

  const scan = useCallback(async () => {
    setSearching(true)
    setServers([])
    let found: VerifiedServer[] = []
    if (isTauri()) {
      const discovered = await discoverServers(4000)
      const verified = await Promise.all(
        discovered.map((d) => verifyServer(d.host, d.port || 3000, d.realtimePort || 3003, d.name))
      )
      found = verified.filter((v): v is VerifiedServer => v !== null)
    }
    setServers(found)
    setSearching(false)
  }, [])

  useEffect(() => {
    if (discoveryDone.current) return
    discoveryDone.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot discovery on mount
    scan()
  }, [scan])

  const connect = async (srv: VerifiedServer) => {
    setConnecting(`${srv.host}:${srv.port}`)
    const re = await verifyServer(srv.host, srv.port, srv.realtimePort, srv.name)
    if (!re) {
      setConnecting(null)
      return
    }
    setSavedConnection({
      baseUrl: `http://${re.host}:${re.port}`,
      serverId: re.serverId,
      restaurantName: re.restaurantName,
      savedAt: new Date().toISOString(),
    })
    onConnected()
  }

  const connectManual = async () => {
    setManualError(null)
    const h = host.trim()
    const p = Number(port) || 3000
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(h) && !/^[a-zA-Z0-9.-]+$/.test(h)) {
      setManualError(t("connect.invalidAddress"))
      return
    }
    setConnecting(`${h}:${p}`)
    const re = await verifyServer(h, p, 3003)
    if (!re) {
      setConnecting(null)
      setManualError(t("connect.connectionFailed"))
      return
    }
    setSavedConnection({
      baseUrl: `http://${h}:${p}`,
      serverId: re.serverId,
      restaurantName: re.restaurantName,
      savedAt: new Date().toISOString(),
    })
    onConnected()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{t("connect.title")}</CardTitle>
          <CardDescription>{t("connect.searching")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {searching ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t("connect.searching")}</p>
            </div>
          ) : servers.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-center">
              <WifiOff className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">{t("connect.noServers")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("connect.noServersDesc")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((srv) => (
                <button
                  key={`${srv.host}:${srv.port}`}
                  onClick={() => connect(srv)}
                  disabled={connecting !== null}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-semibold text-sm">{srv.restaurantName}</span>
                    </div>
                    {connecting === `${srv.host}:${srv.port}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Server className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("connect.serverAvailable")} · {t("connect.serverId")}: {srv.serverId} · {srv.host}:{srv.port}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={scan} disabled={searching}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> {searching ? t("connect.searching") : t("connect.changeServer")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setManualMode((m) => !m)}>
              <Search className="h-3.5 w-3.5 mr-1" /> {t("connect.manual")}
            </Button>
          </div>

          {manualMode && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="conn-host">{t("connect.address")}</Label>
                <Input id="conn-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.20" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conn-port">{t("connect.port")}</Label>
                <Input id="conn-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" inputMode="numeric" />
              </div>
              {manualError && <p className="text-xs text-destructive">{manualError}</p>}
              <Button className="w-full" onClick={connectManual} disabled={connecting !== null || !host.trim()}>
                {connecting !== null ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("connect.connecting")}</> : <><Wifi className="h-4 w-4 mr-2" /> {t("connect.connect")}</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
