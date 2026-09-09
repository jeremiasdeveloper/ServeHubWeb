"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { ComplaintInfo, EmployeeInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { StatusBadge, PriorityBadge } from "./primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, MessageSquareWarning } from "lucide-react"
import { toast } from "sonner"

const CATEGORIES = ["GENERAL", "SERVICE", "FOOD", "WAIT_TIME", "BILLING", "OTHER"]
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"]
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]

export function ComplaintsView() {
  const t = useApp((s) => s.t)
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [complaints, setComplaints] = useState<ComplaintInfo[]>([])
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [filter, setFilter] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ComplaintInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, e] = await Promise.all([
        api.complaints(),
        can("employees.view") ? api.employees() : Promise.resolve({ employees: [] as EmployeeInfo[], roles: [] }),
      ])
      setComplaints(c.complaints)
      setEmployees(e.employees)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [can, t])

  useEffect(() => { load() }, [load])

  const filtered = complaints.filter((c) => filter === "all" ? true : c.status === filter)

  if (loading && complaints.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={t("complaints.title")}
        description={`${complaints.length} ${t("complaints.title").toLowerCase()}`}
        action={
          can("complaints.create") && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> {t("complaints.new")}</Button>
              </DialogTrigger>
              <ComplaintDialog onClose={() => setCreateOpen(false)} onSaved={load} />
            </Dialog>
          )
        }
      />

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="w-full max-w-xl overflow-x-auto">
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
          {STATUSES.map((s) => <TabsTrigger key={s} value={s}>{t(`status.${s}` as never)}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title={t("complaints.empty")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" >
              <CardContent className="p-4" onClick={() => can("complaints.resolve") && setEditing(c)}>
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="font-semibold text-sm leading-tight flex-1">{c.title}</h3>
                  <div className="flex flex-col gap-1 items-end">
                    <StatusBadge status={c.status} label={t(`status.${c.status}` as never)} />
                    <PriorityBadge priority={c.priority} label={t(`complaints.priority.${c.priority}` as never)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.description}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{t(`complaints.category.${c.category}` as never)}</Badge>
                  {c.customerName && <span>· {c.customerName}</span>}
                  <span>· {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground">
                  {c.assignedTo ? `${t("complaints.assignedTo")}: ${c.assignedTo.displayName}` : `${t("complaints.createdBy")}: ${c.createdBy.displayName}`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && (
            <ComplaintDetail complaint={editing} employees={employees} onClose={() => setEditing(null)} onSaved={load} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ComplaintDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useApp((s) => s.t)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("GENERAL")
  const [priority, setPriority] = useState("NORMAL")
  const [customerName, setCustomerName] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim() || !description.trim()) return
    setSaving(true)
    try {
      await api.createComplaint({ title: title.trim(), description: description.trim(), category, priority, customerName: customerName || undefined })
      toast.success(t("complaints.new"))
      onSaved()
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
        <DialogTitle>{t("complaints.new")}</DialogTitle>
        <DialogDescription>{t("complaints.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2"><Label>{t("complaints.title_field")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("complaints.description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t("complaints.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`complaints.category.${c}` as never)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("complaints.priority")}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`complaints.priority.${p}` as never)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2"><Label>{t("complaints.customer")}</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={saving || !title.trim() || !description.trim()}>{t("common.create")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function ComplaintDetail({ complaint, employees, onClose, onSaved }: {
  complaint: ComplaintInfo
  employees: EmployeeInfo[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useApp((s) => s.t)
  const [status, setStatus] = useState(complaint.status)
  const [assignedToId, setAssignedToId] = useState(complaint.assignedToId ?? "none")
  const [resolution, setResolution] = useState(complaint.resolution ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.updateComplaint(complaint.id, {
        status,
        assignedToId: assignedToId === "none" ? null : assignedToId,
        resolution: resolution || null,
      })
      toast.success(t("common.save"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{complaint.title}</DialogTitle>
        <DialogDescription>{t(`complaints.category.${complaint.category}` as never)} · {new Date(complaint.createdAt).toLocaleString()}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-md bg-muted/50 p-3 text-sm">{complaint.description}</div>
        {complaint.customerName && <div className="text-xs text-muted-foreground">{t("complaints.customer")}: {complaint.customerName}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t("complaints.title_field")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}` as never)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("complaints.assignedTo")}</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("complaints.resolution")}</Label>
          <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        <Button onClick={save} disabled={saving}>{t("common.save")}</Button>
      </DialogFooter>
    </>
  )
}
