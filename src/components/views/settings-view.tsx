"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/store"
import { api } from "@/lib/api-client"
import { PageHeader, Loading, ErrorState } from "./view-primitives"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Building2, Palette, Boxes, Globe, Server, Save } from "lucide-react"
import { toast } from "sonner"

export function SettingsView() {
  const t = useApp((s) => s.t)
  const config = useApp((s) => s.config)!
  const locale = useApp((s) => s.locale)
  const setLocale = useApp((s) => s.setLocale)
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.settings()
      .then((r) => setSettings(r.settings))
      .catch((e) => setError(e instanceof Error ? e.message : t("errors.fetchFailed")))
      .finally(() => setLoading(false))
  }, [t])

  const save = async () => {
    setSaving(true)
    try {
      await api.updateSettings(settings)
      toast.success(t("common.save"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} />

  const update = (k: string, v: string) => setSettings((prev) => ({ ...prev, [k]: v }))

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        action={<Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" /> {t("common.save")}</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Restaurant */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> {t("settings.restaurant")}</CardTitle>
            <CardDescription>{t("settings.restaurantName")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>{t("settings.restaurantName")}</Label>
              <Input value={settings.restaurant_name ?? config.restaurant.name} onChange={(e) => update("restaurant_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.restaurantId")}</Label>
              <Input value={settings.restaurant_id ?? config.restaurant.id} onChange={(e) => update("restaurant_id", e.target.value)} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> {t("settings.branding")}</CardTitle>
            <CardDescription>{config.branding.primaryColor}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs capitalize">{k.replace("Color", "")}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.branding[k]}
                      onChange={() => {}}
                      disabled
                      className="h-9 w-12 rounded border cursor-not-allowed"
                    />
                    <span className="text-xs font-mono">{config.branding[k]}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Los colores de branding se configuran en <code>src/lib/config.ts</code> (build-time).</p>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4" /> {t("settings.features")}</CardTitle>
            <CardDescription>{t("dev.features")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(config.features).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm capitalize">{k}</span>
                <Switch checked={v} disabled />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Las feature flags se configuran en <code>src/lib/config.ts</code>.</p>
          </CardContent>
        </Card>

        {/* Localization + theme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> {t("settings.localization")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>{t("settings.language")}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v as "es" | "en")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.theme")}</Label>
              <Select value={theme ?? "light"} onValueChange={(v) => setTheme(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("settings.theme.light")}</SelectItem>
                  <SelectItem value="dark">{t("settings.theme.dark")}</SelectItem>
                  <SelectItem value="system">{t("settings.theme.system")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Server info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> {t("settings.server")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Version</div><div className="font-mono">{config.server.version}</div></div>
              <div><div className="text-xs text-muted-foreground">Realtime port</div><div className="font-mono">{config.server.realtimePort}</div></div>
              <div><div className="text-xs text-muted-foreground">Default lang</div><div className="font-mono">{config.localization.defaultLanguage}</div></div>
              <div><div className="text-xs text-muted-foreground">Supported</div><div className="font-mono">{config.localization.supportedLanguages.join(", ")}</div></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
