"use client"

// ServeHub — first-run setup wizard
// Shown only when the installation has no users yet. Configures the
// restaurant identity, branding, font and language, then creates the first
// administrator account (password can be generated). Runs once.

import { useEffect, useMemo, useState } from "react"
import { useApp } from "@/lib/store"
import { api, setToken } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCw, UtensilsCrossed } from "lucide-react"
import { toast } from "sonner"
import { SUPPORTED_FONTS } from "@/lib/fonts"

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  let out = ""
  const arr = new Uint32Array(14)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 14; i++) out += alphabet[arr[i] % alphabet.length]
  return out
}

export function SetupWizard({ serverId, onDone }: { serverId: string; onDone: (user: unknown) => void }) {
  const t = useApp((s) => s.t)
  const [restaurantName, setRestaurantName] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#E85D75")
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF")
  const [accentColor, setAccentColor] = useState("#FFB7C5")
  const [font, setFont] = useState("inter")
  const [language, setLanguage] = useState("es")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const restaurantId = useMemo(
    () =>
      restaurantName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, ""),
    [restaurantName]
  )

  useEffect(() => {
    setPassword(generatePassword())
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.completeSetup({
        restaurant: { name: restaurantName.trim(), id: restaurantId },
        branding: { primaryColor, secondaryColor, accentColor },
        appearance: { font },
        localization: { defaultLanguage: language },
        admin: { username: username.trim(), password, displayName: displayName.trim() || username.trim() },
      })
      // Auto-login the freshly created administrator.
      const { user, token } = await api.login(username.trim(), password)
      setToken(token)
      toast.success(t("setup.complete"))
      onDone(user)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("setup.title")}</CardTitle>
          <CardDescription>{t("setup.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {/* Restaurant */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("setup.restaurant")}</h3>
              <div className="space-y-1.5">
                <Label htmlFor="setup-name">{t("setup.restaurantName")}</Label>
                <Input id="setup-name" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="Cafe Sakura" required minLength={2} maxLength={60} />
                {restaurantName && (
                  <p className="text-xs text-muted-foreground">
                    {t("setup.restaurantId")}: <code className="rounded bg-muted px-1">{restaurantId}</code>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-primary">{t("setup.primaryColor")}</Label>
                  <input id="setup-primary" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-secondary">{t("setup.secondaryColor")}</Label>
                  <input id="setup-secondary" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border bg-transparent" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-accent">{t("setup.accentColor")}</Label>
                  <input id="setup-accent" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border bg-transparent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("setup.font")}</Label>
                  <Select value={font} onValueChange={setFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_FONTS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("setup.language")}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Server */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("setup.server")}</h3>
              <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div>
                  <div className="text-sm font-medium">{t("setup.serverId")}</div>
                  <div className="font-mono text-xs text-muted-foreground">{serverId}</div>
                </div>
              </div>
            </section>

            {/* Administrator */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("setup.admin")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-user">{t("setup.adminUser")}</Label>
                  <Input id="setup-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required pattern="[a-zA-Z0-9_.\-]{3,32}" minLength={3} maxLength={32} autoComplete="username" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-display">{t("setup.adminName")}</Label>
                  <Input id="setup-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Administrador" maxLength={60} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-pass">{t("setup.adminPass")}</Label>
                <div className="flex gap-2">
                  <Input id="setup-pass" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="font-mono" />
                  <Button type="button" variant="outline" size="icon" title={t("setup.generate")} onClick={() => setPassword(generatePassword())}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>

            <Button type="submit" className="w-full" disabled={submitting || !restaurantName.trim() || !username.trim() || password.length < 8}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("setup.finishing")}</> : t("setup.finish")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
