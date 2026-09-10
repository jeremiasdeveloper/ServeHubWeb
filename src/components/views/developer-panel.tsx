"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/store"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Code2, Smartphone, X, RefreshCw, Database, Wifi, Server, Shield, Boxes, Bug } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface DevData {
  config: Record<string, unknown>
  permissions: string[]
  counts: Record<string, number>
  realtime: Record<string, unknown>
  roles: { name: string; permissions: string[] }[]
  environment: Record<string, string>
}

export function DeveloperPanel() {
  const t = useApp((s) => s.t)
  const toggleDev = useApp((s) => s.toggleDev)
  const toggleMobilePreview = useApp((s) => s.toggleMobilePreview)
  const mobilePreview = useApp((s) => s.mobilePreview)
  const boot = useApp((s) => s.boot)
  const [data, setData] = useState<DevData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.developer()
      setData(d as unknown as DevData)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const reseed = async () => {
    try {
      const res = await fetch("/api/developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reseed" }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      toast.success(t("dev.reseed") + " ✓")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && toggleDev()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <SheetTitle className="text-base">{t("dev.title")}</SheetTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleDev}><X className="h-4 w-4" /></Button>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t("dev.mobilePreview")}</CardTitle><CardDescription className="text-xs">{t("dev.mobilePreviewDesc")}</CardDescription></CardHeader>
              <CardContent>
                <Button variant={mobilePreview ? "default" : "outline"} size="sm" className="w-full" onClick={toggleMobilePreview}>
                  <Smartphone className="h-4 w-4 mr-2" /> {mobilePreview ? t("dev.exitMobilePreview") : t("dev.mobilePreview")}
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => { load(); boot(); toast.success(t("dev.reloadConfig")) }}><RefreshCw className="h-4 w-4 mr-1" /> {t("dev.reloadConfig")}</Button>
              <Button variant="outline" size="sm" onClick={reseed}><Database className="h-4 w-4 mr-1" /> {t("dev.reseed")}</Button>
            </div>

            {/* Server status */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> {t("dev.serverStatus")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <StatusRow icon={Wifi} label={t("dev.realtime")} ok={data?.realtime?.status === "ok"} value={String(data?.realtime?.status ?? "—")} extra={data?.realtime?.clients !== undefined ? `${data.realtime.clients} clientes` : undefined} />
                <StatusRow icon={Database} label={t("dev.database")} ok={Object.values(data?.counts ?? {}).some((v) => v >= 0)} value={data?.counts ? "OK" : "—"} />
                <StatusRow icon={Shield} label={t("dev.roleConfig")} ok={!!data?.roles?.length} value={`${data?.roles?.length ?? 0} roles`} />
              </CardContent>
            </Card>

            {/* Table counts */}
            {data?.counts && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> {t("dev.tableCounts")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.counts).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                        <span className="font-mono text-muted-foreground">{k}</span>
                        <span className="font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Config */}
            {data?.config && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" /> {t("dev.config")}</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-[10px] font-mono overflow-x-auto rounded bg-muted p-2 max-h-48">{JSON.stringify(data.config, null, 2)}</pre>
                </CardContent>
              </Card>
            )}

            {/* Environment */}
            {data?.environment && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Bug className="h-4 w-4" /> {t("dev.debugInfo")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1 text-xs">
                    {Object.entries(data.environment).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Permissions catalog */}
            {data?.permissions && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">{t("dev.permissions")}</CardTitle><CardDescription className="text-xs">{data.permissions.length} permisos</CardDescription></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {data.permissions.map((p) => <Badge key={p} variant="secondary" className="text-[9px] font-mono">{p}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Role config */}
            {data?.roles && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">{t("dev.roleConfig")}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.roles.map((r) => (
                    <div key={r.name} className="rounded-md border p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{r.name}</span>
                        <Badge variant="outline" className="text-[9px]">{r.permissions.length}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {r.permissions.slice(0, 12).map((p) => <span key={p} className="text-[8px] font-mono text-muted-foreground">{p}</span>)}
                        {r.permissions.length > 12 && <span className="text-[8px] text-muted-foreground">+{r.permissions.length - 12}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {loading && <div className="text-center text-xs text-muted-foreground py-4">{t("common.loading")}</div>}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function StatusRow({ icon: Icon, label, ok, value, extra }: { icon: React.ElementType; label: string; ok: boolean; value: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", ok ? "text-emerald-500" : "text-amber-500")} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="text-right">
        <span className={cn("font-semibold", ok ? "text-emerald-600" : "text-amber-600")}>{value}</span>
        {extra && <div className="text-[10px] text-muted-foreground">{extra}</div>}
      </div>
    </div>
  )
}
