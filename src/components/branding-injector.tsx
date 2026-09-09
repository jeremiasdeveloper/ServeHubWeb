"use client"

import { useEffect } from "react"
import { useApp } from "@/lib/store"

// Injects the configured branding colors as CSS custom properties on :root.
export function BrandingInjector() {
  const config = useApp((s) => s.config)
  useEffect(() => {
    if (!config) return
    const { primaryColor, accentColor, secondaryColor } = config.branding
    const root = document.documentElement
    root.style.setProperty("--brand", primaryColor)
    root.style.setProperty("--brand-accent", accentColor)
    root.style.setProperty("--brand-foreground", secondaryColor)
    // also override --primary so shadcn components pick up the brand color
    root.style.setProperty("--primary", primaryColor)
    root.style.setProperty("--ring", primaryColor)
    root.style.setProperty("--sidebar-primary", primaryColor)
    // document title
    document.title = `${config.restaurant.name} · ServeHub`
  }, [config])
  return null
}
