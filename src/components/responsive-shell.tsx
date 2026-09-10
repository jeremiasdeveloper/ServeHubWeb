"use client"

import { useEffect } from "react"
import {
  LayoutDashboard,
  ClipboardList,
  Table2,
  Users,
  ShieldCheck,
  MessageSquareWarning,
  Headphones,
  MessageCircle,
  CalendarClock,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Code2,
} from "lucide-react"
import { useApp, type ViewKey } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import { useState } from "react"
import { useRealtime } from "@/lib/use-realtime"
import { toast } from "sonner"
import { api } from "@/lib/api-client"

interface NavItem {
  key: ViewKey
  labelKey: Parameters<ReturnType<typeof useApp.getState>["t"]>[0]
  icon: React.ElementType
  perm: string
  feature?: keyof ReturnType<typeof useApp.getState>["config"] extends infer C ? C extends null ? never : C extends { features: infer F } ? keyof F : never : never
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
  { key: "orders", labelKey: "nav.orders", icon: ClipboardList, perm: "orders.view", feature: "orders" },
  { key: "tables", labelKey: "nav.tables", icon: Table2, perm: "tables.view", feature: "tables" },
  { key: "employees", labelKey: "nav.employees", icon: Users, perm: "employees.view", feature: "employees" },
  { key: "roles", labelKey: "nav.roles", icon: ShieldCheck, perm: "roles.view" },
  { key: "complaints", labelKey: "nav.complaints", icon: MessageSquareWarning, perm: "complaints.view", feature: "complaints" },
  { key: "customerService", labelKey: "nav.customerService", icon: Headphones, perm: "customerService.view", feature: "customerService" },
  { key: "chat", labelKey: "nav.chat", icon: MessageCircle, perm: "chat.view", feature: "chat" },
  { key: "attendance", labelKey: "nav.attendance", icon: CalendarClock, perm: "attendance.view", feature: "attendance" },
  { key: "notifications", labelKey: "nav.notifications", icon: Bell, perm: "notifications.view", feature: "notifications" },
  { key: "settings", labelKey: "nav.settings", icon: Settings, perm: "settings.view" },
]

function useNavItems() {
  const config = useApp((s) => s.config)
  const { can } = usePermissions()
  return NAV_ITEMS.filter((item) => {
    if (!can(item.perm)) return false
    if (item.feature && config?.features && !config.features[item.feature as keyof typeof config.features]) return false
    return true
  })
}

// Hook into realtime to refresh notifications & toast on events
function RealtimeListener() {
  const setView = useApp((s) => s.setView)
  const t = useApp((s) => s.t)
  useRealtime((e) => {
    if (e.type === "order.ready") {
      toast.success(t("notifications.type.ORDER_READY"), { description: String(e.body ?? "") })
    } else if (e.type === "notification.created") {
      toast.info(String(e.title ?? ""), { description: String(e.body ?? "") })
    } else if (e.type === "message.created") {
      // do not toast every message to avoid spam; chat view refreshes itself
    }
  })
  return null
}

// F10 developer mode toggle (desktop only)
function DevModeKeybind() {
  const toggleDev = useApp((s) => s.toggleDev)
  const { isDeveloper } = usePermissions()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault()
        if (isDeveloper) toggleDev()
        else toast.error("Sin permiso de desarrollador")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggleDev, isDeveloper])
  return null
}

export function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const config = useApp((s) => s.config)
  const user = useApp((s) => s.user)
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const t = useApp((s) => s.t)
  const logout = useApp((s) => s.logout)
  const realtimeConnected = useApp((s) => s.realtimeConnected)
  const devMode = useApp((s) => s.devMode)
  const toggleDev = useApp((s) => s.toggleDev)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const items = useNavItems()
  const restaurantName = config?.restaurant.name ?? "ServeHub"

  // poll unread notifications
  useEffect(() => {
    if (!user) return
    let active = true
    const poll = async () => {
      try {
        const { unread } = await api.notifications(true)
        if (active) setUnread(unread)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 15000)
    return () => { active = false; clearInterval(id) }
  }, [user])

  const go = (v: ViewKey) => {
    setView(v)
    setMobileOpen(false)
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-extrabold text-lg shadow-sm"
          style={{ background: `linear-gradient(135deg, ${config?.branding.primaryColor ?? "#E85D75"}, ${config?.branding.accentColor ?? "#FFB7C5"})` }}
        >
          {restaurantName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-sidebar-foreground">{restaurantName}</div>
          <div className="truncate text-[11px] text-muted-foreground">ServeHub</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = view === item.key
          const showBadge = item.key === "notifications" && unread > 0
          return (
            <button
              key={item.key}
              onClick={() => go(item.key)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left truncate">{t(item.labelKey)}</span>
              {showBadge && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px] justify-center">{unread > 9 ? "9+" : unread}</Badge>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {user.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.displayName}</div>
              <div className="truncate text-[11px] text-muted-foreground">{user.role.name}</div>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => logout()}>
          <LogOut className="h-4 w-4 mr-2" />
          {t("common.logout")}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <RealtimeListener />
      <DevModeKeybind />

      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-sidebar-border bg-sidebar z-30">
        {SidebarContent}
      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur px-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {SidebarContent}
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-sm"
            style={{ background: config?.branding.primaryColor ?? "#E85D75" }}
          >
            {restaurantName.charAt(0).toUpperCase()}
          </div>
          <span className="font-bold text-sm truncate">{restaurantName}</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-full px-2 py-1" title={realtimeConnected ? "Conectado" : "Desconectado"}>
            {realtimeConnected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-amber-500" />}
          </div>
          <Button variant="ghost" size="icon" className="relative" onClick={() => go("notifications")} aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Desktop top header */}
      <header className="hidden lg:flex sticky top-0 z-20 h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-6 lg:pl-[17rem]">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-muted-foreground">{restaurantName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs" title={realtimeConnected ? "Tiempo real conectado" : "Tiempo real desconectado"}>
            {realtimeConnected ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-amber-500" />}
            <span className="text-muted-foreground">{realtimeConnected ? "Online" : "Offline"}</span>
          </div>
          <Button variant="ghost" size="icon" className="relative" onClick={() => go("notifications")} aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
          <Button
            variant={devMode ? "default" : "outline"}
            size="sm"
            onClick={() => toggleDev()}
            className="hidden"
            aria-label="Developer mode"
          >
            <Code2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-0">
        <div className="@container mx-auto w-full max-w-7xl p-4 lg:p-6">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur safe-area-inset-bottom">
        <div className="grid grid-cols-5 gap-1 px-1 py-1">
          {/* primary 5 items, prioritized */}
          {(() => {
            const priority: ViewKey[] = ["dashboard", "orders", "chat", "attendance", "notifications"]
            const present = priority.filter((k) => items.some((i) => i.key === k))
            const picks = present.length >= 5 ? present.slice(0, 5) : [...present, ...items.filter((i) => !priority.includes(i.key)).slice(0, 5 - present.length).map((i) => i.key)]
            return picks.map((key) => {
              const item = items.find((i) => i.key === key)!
              const Icon = item.icon
              const active = view === key
              const showBadge = key === "notifications" && unread > 0
              return (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate max-w-[60px]">{t(item.labelKey)}</span>
                  {showBadge && (
                    <span className="absolute top-0.5 right-1/4 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                  {active && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-primary" />}
                </button>
              )
            })
          })()}
        </div>
      </nav>

      {/* Footer (desktop) */}
      <footer className="hidden lg:block mt-auto border-t bg-background py-3 lg:pl-64">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>{t("footer.poweredBy")}</span>
          <span>{t("footer.version", { version: config?.server.version ?? "1.0.0" })}</span>
        </div>
      </footer>
    </div>
  )
}

export { X }
