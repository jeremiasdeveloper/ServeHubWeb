"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp } from "@/lib/store"
import { usePermissions } from "@/lib/use-permissions"
import { api } from "@/lib/api-client"
import type { EmployeeInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Users, UserPlus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function EmployeesView() {
  const t = useApp((s) => s.t)
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [editing, setEditing] = useState<EmployeeInfo | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.employees()
      setEmployees(r.employees)
      setRoles(r.roles)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const toggleActive = async (emp: EmployeeInfo) => {
    try {
      await api.updateEmployee(emp.id, { active: !emp.active })
      toast.success(emp.active ? t("employees.disable") : t("employees.enable"))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }

  if (loading && employees.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={t("employees.title")}
        description={`${employees.length} ${t("employees.title").toLowerCase()}`}
        action={
          can("employees.create") && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" /> {t("employees.add")}</Button>
              </DialogTrigger>
              <EmployeeDialog roles={roles} onClose={() => setCreateOpen(false)} onSaved={load} />
            </Dialog>
          )
        }
      />

      {employees.length === 0 ? (
        <EmptyState icon={Users} title={t("employees.empty")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((emp) => (
            <Card key={emp.id} className={cn(!emp.active && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {emp.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{emp.displayName}</span>
                      <Badge variant="outline" className="text-xs">{emp.role.name}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">@{emp.username}</div>
                    {emp.email && <div className="text-xs text-muted-foreground truncate">{emp.email}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {emp.lastLoginAt ? `${t("employees.lastLogin")}: ${new Date(emp.lastLoginAt).toLocaleDateString()}` : t("employees.lastLogin") + ": —"}
                    </div>
                  </div>
                </div>
                {can("employees.edit") && (
                  <div className="mt-3 flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Switch checked={emp.active} onCheckedChange={() => toggleActive(emp)} />
                      <span className="text-xs text-muted-foreground">{emp.active ? t("employees.active") : t("employees.inactive")}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(emp)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> {t("common.edit")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <EmployeeDialog roles={roles} employee={editing} onClose={() => setEditing(null)} onSaved={load} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmployeeDialog({ roles, employee, onClose, onSaved }: {
  roles: { id: string; name: string }[]
  employee?: EmployeeInfo
  onClose: () => void
  onSaved: () => void
}) {
  const t = useApp((s) => s.t)
  const [username, setUsername] = useState(employee?.username ?? "")
  const [displayName, setDisplayName] = useState(employee?.displayName ?? "")
  const [email, setEmail] = useState(employee?.email ?? "")
  const [roleId, setRoleId] = useState(employee?.roleId ?? roles[0]?.id ?? "")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!displayName.trim() || !roleId) return
    if (!employee && (!username.trim() || !password)) return
    setSaving(true)
    try {
      if (employee) {
        await api.updateEmployee(employee.id, {
          displayName: displayName.trim(),
          email: email || undefined,
          roleId,
          ...(password ? { password } : {}),
        })
        toast.success(t("common.save"))
      } else {
        await api.createEmployee({ username: username.trim(), displayName: displayName.trim(), email: email || undefined, roleId, password })
        toast.success(t("employees.add"))
      }
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
        <DialogTitle>{employee ? t("employees.edit") : t("employees.add")}</DialogTitle>
        <DialogDescription>{employee ? employee.username : t("employees.username")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {!employee && (
          <div className="space-y-2">
            <Label>{t("employees.username")}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={!!employee} />
          </div>
        )}
        <div className="space-y-2">
          <Label>{t("employees.displayName")}</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("employees.email")}</Label>
          <Input type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("employees.role")}</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("employees.password")}{employee && " (opcional)"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={employee ? "••••" : "0000"} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={saving || !displayName.trim() || (!employee && (!username.trim() || !password))}>{t("common.save")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
