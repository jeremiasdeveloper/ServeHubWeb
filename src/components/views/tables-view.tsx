"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { TableInfo } from "@/lib/types"
import { TABLE_STATUSES } from "@/lib/order-state"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { StatusBadge } from "./primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Table2, Users } from "lucide-react"
import { toast } from "sonner"

export function TablesView() {
  const t = useApp((s) => s.t)
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tables, setTables] = useState<TableInfo[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.tables()
      setTables(r.tables)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const setStatus = async (table: TableInfo, status: string) => {
    try {
      await api.updateTable(table.id, { status })
      toast.success(`${t("tables.number")} ${table.number} → ${t(`status.${status}` as never)}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }

  if (loading && tables.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={t("tables.title")}
        description={`${tables.length} ${t("tables.title").toLowerCase()}`}
        action={
          can("tables.edit") && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> {t("tables.add")}</Button>
              </DialogTrigger>
              <CreateTableDialog onClose={() => setCreateOpen(false)} onCreated={load} />
            </Dialog>
          )
        }
      />

      {tables.length === 0 ? (
        <EmptyState icon={Table2} title={t("tables.empty")} />
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tables.map((tb) => (
            <Card key={tb.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-2 space-y-1.5">
                  <div className="text-base font-bold leading-none">{t("tables.number")} {tb.number}</div>
                  <div className="flex items-center justify-between gap-1.5">
                    {tb.location ? (
                      <span className="text-[11px] text-muted-foreground truncate">{tb.location}</span>
                    ) : <span />}
                    <StatusBadge status={tb.status} label={t(`status.${tb.status}` as never)} className="shrink-0" />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Users className="h-3 w-3" /> {tb.capacity}
                </div>
                {can("tables.edit") && (
                  <Select value={tb.status} onValueChange={(v) => setStatus(tb, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TABLE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{t(`status.${s}` as never)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateTableDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useApp((s) => s.t)
  const [number, setNumber] = useState("")
  const [capacity, setCapacity] = useState(4)
  const [location, setLocation] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!number.trim()) return
    setSaving(true)
    try {
      await api.createTable({ number: number.trim(), capacity: Number(capacity), location: location || undefined })
      toast.success(t("tables.add"))
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("tables.add")}</DialogTitle>
        <DialogDescription>{t("tables.number")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>{t("tables.number")}</Label>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="01" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t("tables.capacity")}</Label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>{t("tables.location")}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={!number.trim() || saving}>{t("common.create")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
