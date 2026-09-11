"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import { useRealtime } from "@/lib/use-realtime"
import type { OrderInfo, TableInfo, EmployeeInfo, ComplaintInfo, AttendanceInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, CardGrid } from "./view-primitives"
import { StatusBadge } from "./primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ClipboardList, CheckCircle2, Users, Table2, MessageSquareWarning, CalendarClock, Plus, ArrowRight, Activity, Wifi, Database, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardView() {
  const t = useApp((s) => s.t)
  const user = useApp((s) => s.user)!
  const setView = useApp((s) => s.setView)
  const config = useApp((s) => s.config)!
  const { can } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [complaints, setComplaints] = useState<ComplaintInfo[]>([])
  const [attendance, setAttendance] = useState<AttendanceInfo[]>([])
  const [health, setHealth] = useState<Record<string, unknown>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const tasks: Promise<unknown>[] = []
      if (can("orders.view")) tasks.push(api.orders().then((r) => setOrders(r.orders)))
      if (can("tables.view")) tasks.push(api.tables().then((r) => setTables(r.tables)))
      if (can("employees.view")) tasks.push(api.employees().then((r) => setEmployees(r.employees)))
      if (can("complaints.view")) tasks.push(api.complaints().then((r) => setComplaints(r.complaints)))
      if (can("attendance.view")) tasks.push(api.attendance().then((r) => setAttendance(r.records)))
      tasks.push(api.health().then((h) => setHealth(h)).catch(() => {}))
      await Promise.all(tasks)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Live refresh: when any order/notification event arrives, silently reload data
  useRealtime((e) => {
    if (e.type === "order.created" || e.type === "order.updated" || e.type === "order.ready" || e.type === "order.delivered") {
      load()
    }
  })

  if (loading && orders.length === 0 && tables.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  const activeOrders = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status))
  const readyOrders = orders.filter((o) => o.status === "READY")
  const openComplaints = complaints.filter((c) => ["OPEN", "IN_PROGRESS"].includes(c.status))

  const stats = [
    { key: "activeOrders", value: activeOrders.length, icon: ClipboardList, color: "text-blue-600 bg-blue-50", show: can("orders.view"), view: "orders" as const },
    { key: "readyOrders", value: readyOrders.length, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", show: can("orders.view"), view: "orders" as const },
    { key: "tables", value: tables.length, icon: Table2, color: "text-purple-600 bg-purple-50", show: can("tables.view"), view: "tables" as const },
    { key: "employees", value: employees.length, icon: Users, color: "text-amber-600 bg-amber-50", show: can("employees.view"), view: "employees" as const },
    { key: "openComplaints", value: openComplaints.length, icon: MessageSquareWarning, color: "text-red-600 bg-red-50", show: can("complaints.view"), view: "complaints" as const },
    { key: "todayAttendance", value: attendance.length, icon: CalendarClock, color: "text-cyan-600 bg-cyan-50", show: can("attendance.view"), view: "attendance" as const },
  ].filter((s) => s.show)

  return (
    <div>
      <PageHeader
        title={t("dashboard.title")}
        description={`${t("dashboard.welcome", { name: user.displayName })} · ${t("dashboard.role", { role: user.role.name })}`}
      />

      {/* Stat cards */}
      <CardGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-6">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <button key={s.key} onClick={() => setView(s.view)} className="text-left">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg", s.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t(`dashboard.${s.key}` as never)}</div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </CardGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        {can("orders.view") && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{t("dashboard.recentOrders")}</CardTitle>
                <CardDescription className="text-xs">{activeOrders.length} {t("orders.active").toLowerCase()}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("orders")}>
                {t("dashboard.viewOrders")} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto scroll-thin">
              {activeOrders.slice(0, 8).map((o) => (
                <button key={o.id} onClick={() => setView("orders")} className="w-full text-left flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                    #{o.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{t("orders.table")} {o.table.number}</span>
                      <StatusBadge status={o.status} label={t(`status.${o.status}` as never)} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">${o.total.toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground">{o.createdBy.displayName}</div>
                  </div>
                </button>
              ))}
              {activeOrders.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">{t("orders.empty")}</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* System status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> {t("dashboard.systemStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow icon={Wifi} label={t("dev.apiStatus")} value={health.web === "ok" ? "OK" : "—"} ok={health.web === "ok"} />
            <StatusRow icon={Database} label={t("dev.database")} value={health.database === "ok" ? "OK" : "Error"} ok={health.database === "ok"} />
            <StatusRow icon={Radio} label={t("dev.realtime")} value={health.realtime === "ok" ? "OK" : "Offline"} ok={health.realtime === "ok"} />
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">{config.restaurant.name}</div>
              <div className="text-xs text-muted-foreground">v{config.server.version}</div>
            </div>
            {can("orders.create") && (
              <Button className="w-full mt-2" onClick={() => setView("orders")}>
                <Plus className="h-4 w-4 mr-2" /> {t("dashboard.newOrder")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today attendance */}
      {can("attendance.view") && attendance.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("dashboard.todayAttendance")}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("attendance")}>
              {t("nav.attendance")} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {attendance.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">
                      {a.user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate max-w-[120px]">{a.user.displayName}</div>
                    <div className="text-[11px] text-muted-foreground">{a.user.role.name}</div>
                  </div>
                  <StatusBadge status={a.status} label={t(`attendance.status.${a.status}` as never)} className="ml-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusRow({ icon: Icon, label, value, ok }: { icon: React.ElementType; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <Icon className={cn("h-4 w-4", ok ? "text-emerald-500" : "text-muted-foreground")} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={cn("text-xs font-semibold", ok ? "text-emerald-600" : "text-amber-600")}>{value}</span>
    </div>
  )
}
