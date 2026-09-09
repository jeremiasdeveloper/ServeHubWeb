"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Loader2, UtensilsCrossed, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"

export function LoginScreen() {
  const t = useApp((s) => s.t)
  const config = useApp((s) => s.config)
  const login = useApp((s) => s.login)
  const commitPendingAdmin = useApp((s) => s.commitPendingAdmin)
  const cancelPendingAdmin = useApp((s) => s.cancelPendingAdmin)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [needsAdminWarning, setNeedsAdminWarning] = useState(false)
  const [countdown, setCountdown] = useState(10)

  const restaurantName = config?.restaurant.name ?? "ServeHub"
  const primary = config?.branding.primaryColor ?? "#E85D75"
  const accent = config?.branding.accentColor ?? "#FFB7C5"

  useEffect(() => {
    if (!needsAdminWarning) return
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [needsAdminWarning, countdown])

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    try {
      const res = await login(username.trim(), password)
      if (res.needsAdminWarning) {
        setNeedsAdminWarning(true)
        setCountdown(10)
        toast.info(t("admin.warningTitle"))
      } else {
        toast.success(`Bienvenido`)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("login.error")
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const continueAsAdmin = () => {
    commitPendingAdmin()
    setNeedsAdminWarning(false)
    toast.success("Bienvenido")
  }

  const cancelAdmin = () => {
    cancelPendingAdmin()
    setNeedsAdminWarning(false)
    setCountdown(10)
    setUsername("")
    setPassword("")
  }

  const fillAdmin = () => {
    setUsername("admin")
    setPassword("0000")
  }

  if (needsAdminWarning) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)` }}>
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <ShieldAlert className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">{t("admin.warningTitle")}</CardTitle>
            <CardDescription>{t("admin.warningDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-center">
              <p className="text-lg font-bold text-amber-800">{t("admin.warning")}</p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {countdown > 0 ? t("admin.countdown", { seconds: countdown }) : t("admin.continue")}
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={cancelAdmin}>
              {t("admin.cancel")}
            </Button>
            <Button className="flex-1" disabled={countdown > 0} onClick={continueAsAdmin} style={{ backgroundColor: primary }}>
              {t("admin.continue")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="flex flex-1 flex-col justify-between p-8 lg:p-12 text-white" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)` }}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold">ServeHub</div>
            <div className="text-xs text-white/80">{t("app.tagline")}</div>
          </div>
        </div>

        <div className="my-12 lg:my-0">
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
            {restaurantName}
          </h1>
          <p className="mt-3 text-white/85 max-w-md">
            {t("app.tagline")} — {t("dashboard.title").toLowerCase()}, {t("nav.orders").toLowerCase()}, {t("nav.tables").toLowerCase()}, {t("nav.chat").toLowerCase()} y más.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" /> {t("nav.orders")} · {t("dashboard.activeOrders").toLowerCase()}</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" /> {t("nav.tables")} · {t("nav.employees").toLowerCase()}</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" /> {t("nav.chat")} · {t("nav.notifications").toLowerCase()} en tiempo real</li>
          </ul>
        </div>

        <div className="text-xs text-white/70">ServeHub · v{config?.server.version ?? "1.0.0"}</div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12 bg-background">
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">{t("login.title")}</CardTitle>
            <CardDescription>{t("login.subtitle")}</CardDescription>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t("login.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("login.usernamePlaceholder")}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t("login.demoTitle")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("login.demoDesc")}</p>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-mono">
                  <button type="button" onClick={() => { setUsername("admin"); setPassword("0000") }} className="rounded px-2 py-1 bg-background hover:bg-accent text-left">admin / 0000</button>
                  <button type="button" onClick={() => { setUsername("manager01"); setPassword("0000") }} className="rounded px-2 py-1 bg-background hover:bg-accent text-left">manager01 / 0000</button>
                  <button type="button" onClick={() => { setUsername("waiter01"); setPassword("0000") }} className="rounded px-2 py-1 bg-background hover:bg-accent text-left">waiter01 / 0000</button>
                  <button type="button" onClick={() => { setUsername("kitchen01"); setPassword("0000") }} className="rounded px-2 py-1 bg-background hover:bg-accent text-left">kitchen01 / 0000</button>
                  <button type="button" onClick={() => { setUsername("cashier01"); setPassword("0000") }} className="rounded px-2 py-1 bg-background hover:bg-accent text-left">cashier01 / 0000</button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button type="submit" className="w-full" disabled={loading || !username || !password} style={{ backgroundColor: primary }}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("login.loggingIn")}</> : t("login.submit")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={fillAdmin} className="w-full text-xs text-muted-foreground">
                {t("login.fillAdmin")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
