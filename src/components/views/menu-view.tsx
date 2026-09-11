"use client"

// ServeHub — menu management view (categories & products)
import { useCallback, useEffect, useState } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { MenuCategoryInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, UtensilsCrossed, CircleCheck, CircleSlash, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function MenuView() {
  const t = useApp((s) => s.t)
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategoryInfo[]>([])
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [itemDialog, setItemDialog] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.menu()
      setCategories(r.categories)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const toggleAvailability = async (catId: string, item: MenuCategoryInfo["items"][number]) => {
    try {
      await api.updateMenuItem(item.id, { available: !item.available })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }

  if (loading && categories.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={t("menu.title")}
        description={t("menu.desc")}
        action={
          <div className="flex flex-wrap gap-2">
            {can("menu.create") && (
              <>
                <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> {t("menu.newCategory")}</Button>
                  </DialogTrigger>
                  <NewCategoryDialog onCreated={() => { setCategoryDialog(false); load() }} />
                </Dialog>
                <Dialog open={itemDialog} onOpenChange={setItemDialog}>
                  <DialogTrigger asChild>
                    <Button disabled={categories.length === 0}><Plus className="h-4 w-4 mr-2" /> {t("menu.newItem")}</Button>
                  </DialogTrigger>
                  <NewItemDialog categories={categories} onCreated={() => { setItemDialog(false); load() }} />
                </Dialog>
              </>
            )}
          </div>
        }
      />

      {categories.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title={t("menu.empty")} description={t("menu.emptyDesc")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cat.items.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">{t("menu.emptyDesc")}</p>
                )}
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{item.name}</span>
                        {item.available ? (
                          <Badge variant="outline" className="text-green-600 shrink-0">{t("menu.available")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground shrink-0">{t("menu.unavailable")}</Badge>
                        )}
                      </div>
                      {item.description && <div className="text-xs text-muted-foreground truncate">{item.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold">${item.price.toFixed(2)}</span>
                      {can("menu.edit") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={item.available ? t("menu.markUnavailable") : t("menu.markAvailable")} onClick={() => toggleAvailability(cat.id, item)}>
                          {item.available ? <CircleCheck className="h-4 w-4 text-green-600" /> : <CircleSlash className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function NewCategoryDialog({ onCreated }: { onCreated: () => void }) {
  const t = useApp((s) => s.t)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createMenuCategory({ name: name.trim() })
      toast.success(t("menu.newCategory"))
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{t("menu.newCategory")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">{t("menu.name")}</Label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} {t("menu.newCategory")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function NewItemDialog({ categories, onCreated }: { categories: MenuCategoryInfo[]; onCreated: () => void }) {
  const t = useApp((s) => s.t)
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createMenuItem({ name: name.trim(), categoryId, price: Number(price), description: description || undefined })
      toast.success(t("menu.newItem"))
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{t("menu.newItem")}</DialogTitle>
        <DialogDescription>{t("menu.desc")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-name">{t("menu.name")}</Label>
          <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("menu.category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="item-price">{t("menu.price")}</Label>
            <Input id="item-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-desc">{t("menu.description")}</Label>
            <Input id="item-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !name.trim() || !categoryId || price === ""}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} {t("menu.newItem")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
