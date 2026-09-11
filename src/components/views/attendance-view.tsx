"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { AttendanceInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { StatusBadge } from "./primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogIn, LogOut, CalendarClock, Clock } from "lucide-react"
import { toast } from "sonner"

export function AttendanceView() {
  const t = useApp((s) => s.t)
  const user = useApp((s) => s.user)!
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<AttendanceInfo[]>([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [myRecord, setMyRecord] = useState<AttendanceInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.attendance(date)
      setRecords(r.records)
      setMyRecord(r.records.find((a) => a.userId === user.id) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [date, user.id, t])

  useEffect(() => { load() }, [load])

  const checkIn = async () => {
    try {
      await api.checkAction("in")
      toast.success(t("attendance.checkIn"))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }
  const checkOut = async () => {
    try {
      await api.checkAction("out")
      toast.success(t("attendance.checkOut"))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }

  if (loading && records.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={t("attendance.title")}
        description={`${t("attendance.today")} · ${new Date(date).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}`}
      />

      {/* Self check-in/out card */}
      {can("attendance.self") && (
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{user.displayName}</div>
                <div className="text-xs text-muted-foreground">
                  {myRecord?.checkIn ? `${t("attendance.checkInTime")}: ${new Date(myRecord.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : t("attendance.notCheckedIn")}
                  {myRecord?.checkOut ? ` · ${t("attendance.checkOutTime")}: ${new Date(myRecord.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={checkIn} disabled={!!myRecord?.checkIn} variant="default">
                <LogIn className="h-4 w-4 mr-2" /> {t("attendance.checkIn")}
              </Button>
              <Button onClick={checkOut} disabled={!myRecord?.checkIn || !!myRecord?.checkOut} variant="outline">
                <LogOut className="h-4 w-4 mr-2" /> {t("attendance.checkOut")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("attendance.empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {records.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {a.user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{a.user.displayName}</span>
                      <span className="text-xs text-muted-foreground">{a.user.role.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      <span className="flex items-center gap-1"><LogOut className="h-3 w-3" /> {a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    </div>
                  </div>
                  <StatusBadge status={a.status} label={t(`attendance.status.${a.status}` as never)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
