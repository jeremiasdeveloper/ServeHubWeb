"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { OrderInfo, TableInfo } from "@/lib/types"
import { canTransition, nextStatuses, TRANSITION_PERMISSIONS, ORDER_STATUSES } from "@/lib/order-state"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { StatusBadge } from "./primitives"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, ClipboardList, Utensils, ChefHat, CheckCircle2, XCircle, History, Send, Trash2, FileDown } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/lib/use-realtime"

const FILTERS = [
  { key: "all", labelKey: "orders.all", statuses: [] as string[] },
  { key: "active", labelKey: "orders.active", statuses: ["DRAFT", "SENT", "RECEIVED", "PREPARING", "READY", "DELIVERED"] },
  { key: "kitchen", labelKey: "orders.kitchen", statuses: ["SENT", "RECEIVED", "PREPARING", "READY"] },
  { key: "history", labelKey: "orders.history", statuses: ["COMPLETED", "CANCELLED"] },
]

export function OrdersView() {
  const t = useApp((s) => s.t)
  const config = useApp((s) => s.config)
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [filter, setFilter] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<OrderInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, tb] = await Promise.all([
        api.orders(),
        can("tables.view") ? api.tables() : Promise.resolve({ tables: [] as TableInfo[], statuses: [] }),
      ])
      setOrders(o.orders)
      setTables(tb.tables)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [can, t])

  useEffect(() => { load() }, [load])

  // realtime: refresh on order events
  useRealtime((e) => {
    if (e.type === "order.created" || e.type === "order.updated" || e.type === "order.ready" || e.type === "order.delivered") {
      load()
      if (selected && e.orderId === selected.id) {
        api.order(selected.id).then((r) => setSelected(r.order)).catch(() => {})
      }
    }
  })

  const filtered = orders.filter((o) => {
    const f = FILTERS.find((f) => f.key === filter)!
    if (f.statuses.length === 0) return true
    return f.statuses.includes(o.status)
  })

  // PDF export — jsPDF is loaded lazily on first use (keeps the main
  // bundle small); generation happens fully client-side.
  const exportOrdersToPdf = async (list: OrderInfo[]) => {
    if (list.length === 0) {
      toast.info(t("pdf.exportEmpty"))
      return
    }
    try {
      const mod = await import("@/lib/order-pdf")
      mod.exportOrdersPdf(list, config, t)
      toast.success(t("pdf.exported"))
    } catch {
      toast.error(t("errors.unknown"))
    }
  }

  const exportOrderToPdf = async (o: OrderInfo) => {
    try {
      const mod = await import("@/lib/order-pdf")
      mod.exportOrderPdf(o, config, t)
      toast.success(t("pdf.exported"))
    } catch {
      toast.error(t("errors.unknown"))
    }
  }

  const transition = async (order: OrderInfo, to: string) => {
    try {
      await api.transitionOrder(order.id, to)
      toast.success(`${t("orders.status")}: ${t(`status.${to}` as never)}`)
      await load()
      if (selected?.id === order.id) {
        const r = await api.order(order.id)
        setSelected(r.order)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }

  if (loading && orders.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={t("orders.title")}
        description={`${orders.length} ${t("orders.title").toLowerCase()}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => exportOrdersToPdf(filtered)} aria-label={t("pdf.exportAll")}>
              <FileDown className="h-4 w-4 mr-2" /> {t("pdf.exportAll")}
            </Button>
            {can("orders.create") && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> {t("orders.new")}</Button>
                </DialogTrigger>
                <CreateOrderDialog tables={tables} onClose={() => setCreateOpen(false)} onCreated={() => load()} />
              </Dialog>
            )}
          </div>
        }
      />

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="w-full max-w-md">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key} className="flex-1">{t(f.labelKey as never)}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("orders.empty")}
          description={t("orders.emptyDesc")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onTransition={(to) => transition(o, to)}
              onOpen={() => setSelected(o)}
              onExportPdf={() => exportOrderToPdf(o)}
              can={can}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Order detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selected && (
            <OrderDetail
              order={selected}
              onTransition={(to) => transition(selected, to)}
              onRefresh={async () => {
                const r = await api.order(selected.id)
                setSelected(r.order)
              }}
              onExportPdf={() => exportOrderToPdf(selected)}
              can={can}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrderCard({ order, onTransition, onOpen, onExportPdf, can, t }: {
  order: OrderInfo
  onTransition: (to: string) => void
  onOpen: () => void
  onExportPdf: () => void
  can: (p: string) => boolean
  t: ReturnType<typeof useApp.getState>["t"]
}) {
  const next = nextStatuses(order.status)
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
              #{order.number}
            </div>
            <div>
              <div className="font-semibold text-sm">{t("orders.table")} {order.table.number}</div>
              <div className="text-[11px] text-muted-foreground">{order.createdBy.displayName}</div>
            </div>
          </div>
          <StatusBadge status={order.status} label={t(`status.${order.status}` as never)} />
        </div>

        <div className="space-y-1 mb-3">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                <span className="font-medium">{it.quantity}×</span> {it.name}
                {it.notes && <span className="text-muted-foreground"> ({it.notes})</span>}
              </span>
              <span className="text-muted-foreground text-xs">${(it.price * it.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="mb-3 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{t("orders.notes")}:</span> {order.notes}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          <div className="text-sm font-bold">${order.total.toFixed(2)}</div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={onExportPdf} className="px-2" title={t("pdf.exportOne")} aria-label={t("pdf.exportOne")}>
              <FileDown className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpen} className="px-2">
              <History className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">{t("orders.orderDetails")}</span>
            </Button>
            {next.map((to) => {
              const perm = TRANSITION_PERMISSIONS[`${order.status}->${to}`]
              if (perm && !can(perm)) return null
              const labels: Record<string, string> = {
                SENT: "orders.send",
                RECEIVED: "orders.markReceived",
                PREPARING: "orders.markPreparing",
                READY: "orders.markReady",
                DELIVERED: "orders.markDelivered",
                COMPLETED: "orders.markCompleted",
                CANCELLED: "orders.cancel",
              }
              const variant = to === "CANCELLED" ? "destructive" : "default"
              const icon = to === "READY" ? CheckCircle2 : to === "CANCELLED" ? XCircle : to === "SENT" ? Send : to === "DELIVERED" ? Utensils : ChefHat
              const Icon = icon
              return (
                <Button key={to} size="sm" variant={variant} onClick={() => onTransition(to)} className="max-w-full">
                  <Icon className="h-3.5 w-3.5 mr-1 shrink-0" /> <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[9rem]">{t(labels[to] as never)}</span>
                </Button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OrderDetail({ order, onTransition, onRefresh, onExportPdf, can, t }: {
  order: OrderInfo
  onTransition: (to: string) => void
  onRefresh: () => Promise<void>
  onExportPdf: () => void
  can: (p: string) => boolean
  t: ReturnType<typeof useApp.getState>["t"]
}) {
  const next = nextStatuses(order.status)
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {t("orders.orderDetails")} · #{order.number}
          <StatusBadge status={order.status} label={t(`status.${order.status}` as never)} />
        </DialogTitle>
        <DialogDescription>
          {t("orders.table")} {order.table.number} · {t("orders.createdBy")} {order.createdBy.displayName}
          {order.assignedTo && ` · ${t("orders.assignedTo")} ${order.assignedTo.displayName}`}
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4">
          {/* Items */}
          <div>
            <h4 className="text-sm font-semibold mb-2">{t("orders.items")}</h4>
            <div className="space-y-1.5">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <div className="text-sm"><span className="font-medium">{it.quantity}×</span> {it.name}</div>
                    {it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}
                  </div>
                  <div className="text-sm font-medium">${(it.price * it.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span>{t("orders.total")}</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <div>
              <h4 className="text-sm font-semibold mb-1">{t("orders.notes")}</h4>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">{order.notes}</div>
            </div>
          )}

          {/* Status history */}
          {order.history && order.history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">{t("orders.statusHistory")}</h4>
              <div className="space-y-2">
                {order.history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <div className="flex h-2 w-2 rounded-full bg-primary" />
                    <span className="font-medium">{h.toStatus}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
                    {h.note && <span className="text-muted-foreground">· {h.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={onExportPdf} title={t("pdf.exportOne")} aria-label={t("pdf.exportOne")}>
          <FileDown className="h-4 w-4 mr-2" /> PDF
        </Button>
        {next.map((to) => {
          const perm = TRANSITION_PERMISSIONS[`${order.status}->${to}`]
          if (perm && !can(perm)) return null
          const labels: Record<string, string> = {
            SENT: "orders.send", RECEIVED: "orders.markReceived", PREPARING: "orders.markPreparing",
            READY: "orders.markReady", DELIVERED: "orders.markDelivered", COMPLETED: "orders.markCompleted", CANCELLED: "orders.cancel",
          }
          return (
            <Button key={to} variant={to === "CANCELLED" ? "destructive" : "default"} onClick={() => onTransition(to)}>
              {t(labels[to] as never)}
            </Button>
          )
        })}
      </DialogFooter>
    </>
  )
}

function CreateOrderDialog({ tables, onClose, onCreated }: { tables: TableInfo[]; onClose: () => void; onCreated: () => void }) {
  const t = useApp((s) => s.t)
  const [tableId, setTableId] = useState("")
  const [items, setItems] = useState<{ name: string; quantity: number; price: number; notes: string }[]>([{ name: "", quantity: 1, price: 0, notes: "" }])
  const [notes, setNotes] = useState("")
  const [sending, setSending] = useState(false)

  const availableTables = tables.filter((tb) => tb.status !== "OCCUPIED")

  const updateItem = (i: number, field: keyof typeof items[0], value: string | number) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }
  const addItem = () => setItems([...items, { name: "", quantity: 1, price: 0, notes: "" }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const total = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
  const valid = tableId && items.every((it) => it.name.trim() && it.quantity > 0)

  const submit = async (send: boolean) => {
    if (!valid) {
      toast.error(t("orders.noItems"))
      return
    }
    setSending(true)
    try {
      await api.createOrder({
        tableId,
        items: items.map((it) => ({ name: it.name.trim(), quantity: Number(it.quantity), price: Number(it.price), notes: it.notes || undefined })),
        notes: notes || undefined,
        send,
      })
      toast.success(send ? t("orders.sendOrder") : t("orders.saveDraft"))
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSending(false)
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>{t("orders.create")}</DialogTitle>
        <DialogDescription>{t("orders.selectTable")}</DialogDescription>
      </DialogHeader>

      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("orders.table")}</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger><SelectValue placeholder={t("orders.selectTable")} /></SelectTrigger>
              <SelectContent>
                {availableTables.map((tb) => (
                  <SelectItem key={tb.id} value={tb.id}>
                    {t("orders.table")} {tb.number} {tb.location ? `· ${tb.location}` : ""}
                  </SelectItem>
                ))}
                {availableTables.length === 0 && tables.length > 0 && tables.map((tb) => (
                  <SelectItem key={tb.id} value={tb.id}>{t("orders.table")} {tb.number} (ocupada)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("orders.items")}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> {t("orders.addItem")}</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="rounded-md border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder={t("orders.itemName")} value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} className="flex-1" />
                    <Input type="number" min={1} placeholder={t("orders.quantity")} value={it.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} className="w-20" />
                    <Input type="number" min={0} step="0.01" placeholder={t("orders.price")} value={it.price} onChange={(e) => updateItem(i, "price", Number(e.target.value))} className="w-24" />
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                  <Input placeholder={t("orders.itemNotes")} value={it.notes} onChange={(e) => updateItem(i, "notes", e.target.value)} className="text-xs" />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1">
              <span>{t("orders.total")}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("orders.orderNotes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter className="flex-wrap">
        <Button variant="outline" onClick={() => submit(false)} disabled={!valid || sending}>{t("orders.saveDraft")}</Button>
        <Button onClick={() => submit(true)} disabled={!valid || sending}>{t("orders.send")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
