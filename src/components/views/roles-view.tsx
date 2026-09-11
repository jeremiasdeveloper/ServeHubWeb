"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { RoleInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState } from "./view-primitives"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ShieldCheck, Pencil, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function RolesView() {
  const t = useApp((s) => s.t)
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [editing, setEditing] = useState<RoleInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.roles()
      setRoles(r.roles)
      setPermissions(r.permissions)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  if (loading && roles.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader title={t("roles.title")} description={`${roles.length} ${t("roles.title").toLowerCase()}`} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> {r.name}
                  {r.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
                </CardTitle>
                <Badge variant="outline">{t("roles.permissionCount", { count: r.permissions.length })}</Badge>
              </div>
              {r.description && <CardDescription className="text-xs">{r.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>{t("roles.users")}: {r.userCount}</span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-hidden">
                {r.permissions.slice(0, 8).map((p) => (
                  <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>
                ))}
                {r.permissions.length > 8 && <Badge variant="outline" className="text-[10px]">+{r.permissions.length - 8}</Badge>}
              </div>
              {can("roles.edit") && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setEditing(r)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> {t("roles.editPermissions")}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {editing && (
            <EditPermissionsDialog role={editing} permissions={permissions} onClose={() => setEditing(null)} onSaved={load} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditPermissionsDialog({ role, permissions, onClose, onSaved }: {
  role: RoleInfo
  permissions: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useApp((s) => s.t)
  const [selected, setSelected] = useState<string[]>(role.permissions)
  const [saving, setSaving] = useState(false)

  const toggle = (perm: string) => {
    setSelected((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm])
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.updateRole(role.id, { permissions: selected })
      toast.success(t("common.save"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  // group permissions by section
  const groups: Record<string, string[]> = {}
  for (const p of permissions) {
    const section = p.split(".")[0]
    if (!groups[section]) groups[section] = []
    groups[section].push(p)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("roles.editPermissions")} · {role.name}</DialogTitle>
        <DialogDescription>{selected.length} / {permissions.length}</DialogDescription>
      </DialogHeader>
      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4">
          {Object.entries(groups).map(([section, perms]) => (
            <div key={section}>
              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">{section}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {perms.map((p) => (
                  <label key={p} className={cn("flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50", selected.includes(p) && "border-primary bg-primary/5")}>
                    <Checkbox checked={selected.includes(p)} onCheckedChange={() => toggle(p)} />
                    <span className="text-xs font-mono">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={save} disabled={saving}>{t("common.save")}</Button>
      </DialogFooter>
    </>
  )
}
