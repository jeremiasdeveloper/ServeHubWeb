"use client"

import { useState } from "react"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Loader2, UtensilsCrossed } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"

export function LoginScreen() {
  const t = useApp((s) => s.t)
  const config = useApp((s) => s.config)
  const login = useApp((s) => s.login)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const restaurantName = config?.restaurant.name ?? "ServeHub"
  const primary = config?.branding.primaryColor ?? "#E85D75"
  const accent = config?.branding.accentColor ?? "#FFB7C5"

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    try {
      await login(username.trim(), password)
      toast.success("Bienvenido")
    } catch (err) {
      // The server answers 401 with "Credenciales inválidas" — show that
      // message, never a raw "UNAUTHORIZED".
      const msg = err instanceof ApiError ? err.message : t("login.error")
      toast.error(msg)
    } finally {
      setLoading(false)
    }
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
              <Button type="button" variant="ghost" size="sm" onClick={() => { setUsername("admin"); setPassword("0000") }} className="w-full text-xs text-muted-foreground">
                {t("login.fillAdmin")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
