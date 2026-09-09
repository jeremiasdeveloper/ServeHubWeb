"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { api } from "@/lib/api-client"
import type { NotificationInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCheck, ShoppingBag, MessageCircle, MessageSquareWarning, Info } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/lib/use-realtime"

const TYPE_ICON: Record<string, React.ElementType> = {
  ORDER_READY: ShoppingBag,
  NEW_ORDER: ShoppingBag,
  NEW_MESSAGE: MessageCircle,
  COMPLAINT_ASSIGNED: MessageSquareWarning,
  SYSTEM: Info,
}

export function NotificationsView() {
  const t = useApp((s) => s.t)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationInfo[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.notifications()
      setNotifications(r.notifications)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  useRealtime((e) => {
    if (e.type === "notification.created") load()
  })

  const markAll = async () => {
    try {
      await api.markAllRead()
      toast.success(t("notifications.markAllRead"))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }
  const markOne = async (id: string) => {
    try {
      await api.markRead(id)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }

  if (loading && notifications.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        description={unread > 0 ? t("notifications.unread", { count: unread }) : undefined}
        action={unread > 0 ? (
          <Button variant="outline" onClick={markAll}>
            <CheckCheck className="h-4 w-4 mr-2" /> {t("notifications.markAllRead")}
          </Button>
        ) : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title={t("notifications.empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Info
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.read && markOne(n.id)}
                    className={cn("flex w-full items-start gap-3 p-4 text-left hover:bg-accent/50 transition-colors", !n.read && "bg-primary/[0.03]")}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{n.title}</span>
                        <Badge variant="outline" className="text-[10px]">{t(`notifications.type.${n.type}` as never)}</Badge>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                      <span className="text-[11px] text-muted-foreground mt-1 block">{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
