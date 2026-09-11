"use client"

import { useEffect } from "react"
import { useApp } from "@/lib/store"
import { fontStackFor } from "@/lib/fonts"

// Injects the configured branding (colors + font) as CSS custom properties.
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
    // configured typography (bundled fonts only; body-level so it wins over
    // the next/font variable class).
    const stack = fontStackFor(config.appearance?.font ?? "inter")
    document.body.style.setProperty("--font-sans", stack)
    root.style.setProperty("--font-sans", stack)
    // document title
    document.title = `${config.restaurant.name} · ServeHub`
  }, [config])
  return null
}
