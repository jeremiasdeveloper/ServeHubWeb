"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { api } from "@/lib/api-client"
import type { CustomerServiceInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { StatusBadge } from "./primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Headphones, Phone, Mail, User, Globe } from "lucide-react"
import { toast } from "sonner"

const CHANNELS = ["IN_PERSON", "PHONE", "EMAIL", "ONLINE"]
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]

export function CustomerServiceView() {
  const t = useApp((s) => s.t)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CustomerServiceInfo[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerServiceInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.customerService()
      setItems(r.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  if (loading && items.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  const channelIcon: Record<string, React.ElementType> = {
    IN_PERSON: User, PHONE: Phone, EMAIL: Mail, ONLINE: Globe,
  }

  return (
    <div>
      <PageHeader
        title={t("customerService.title")}
        description={`${items.length} ${t("customerService.title").toLowerCase()}`}
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> {t("complaints.newRequest")}</Button>
            </DialogTrigger>
            <CSDialog onClose={() => setCreateOpen(false)} onSaved={load} />
          </Dialog>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={Headphones} title={t("customerService.empty")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const Icon = channelIcon[it.channel] ?? User
            return (
              <Card key={it.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4" onClick={() => setEditing(it)}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-sm truncate">{it.subject}</h3>
                    </div>
                    <StatusBadge status={it.status} label={t(`status.${it.status}` as never)} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{it.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{t(`customerService.channel.${it.channel}` as never)}</Badge>
                    {it.customerName && <span>· {it.customerName}</span>}
                    <span>· {new Date(it.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && <CSDetail item={editing} onClose={() => setEditing(null)} onSaved={load} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CSDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useApp((s) => s.t)
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [channel, setChannel] = useState("IN_PERSON")
  const [customerName, setCustomerName] = useState("")
  const [customerContact, setCustomerContact] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!subject.trim() || !description.trim()) return
    setSaving(true)
    try {
      await api.createCustomerService({ subject: subject.trim(), description: description.trim(), channel, customerName: customerName || undefined, customerContact: customerContact || undefined })
      toast.success(t("complaints.newRequest"))
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
        <DialogTitle>{t("complaints.newRequest")}</DialogTitle>
        <DialogDescription>{t("customerService.subject")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-2"><Label>{t("customerService.subject")}</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("customerService.description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        <div className="space-y-2">
          <Label>{t("customerService.channel")}</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{t(`customerService.channel.${c}` as never)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{t("customerService.customer")}</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{t("customerService.contact")}</Label><Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} /></div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={saving || !subject.trim() || !description.trim()}>{t("common.create")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function CSDetail({ item, onClose, onSaved }: { item: CustomerServiceInfo; onClose: () => void; onSaved: () => void }) {
  const t = useApp((s) => s.t)
  const [status, setStatus] = useState(item.status)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.updateCustomerService(item.id, { status })
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
        <DialogTitle>{item.subject}</DialogTitle>
        <DialogDescription>{t(`customerService.channel.${item.channel}` as never)} · {new Date(item.createdAt).toLocaleString()}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-md bg-muted/50 p-3 text-sm">{item.description}</div>
        {item.customerName && <div className="text-xs text-muted-foreground">{t("customerService.customer")}: {item.customerName}</div>}
        {item.customerContact && <div className="text-xs text-muted-foreground">{t("customerService.contact")}: {item.customerContact}</div>}
        <div className="space-y-2">
          <Label>{t("common.status")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}` as never)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        <Button onClick={save} disabled={saving}>{t("common.save")}</Button>
      </DialogFooter>
    </>
  )
}
