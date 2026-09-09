"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/store"

// Splash screen shown on every cold start. Displays restaurant logo if present,
// otherwise the ServeHub wordmark. Applies configured branding colors.
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const config = useApp((s) => s.config)
  const t = useApp((s) => s.t)
  const [phase, setPhase] = useState(0) // 0: logo, 1: connecting, 2: done

  useEffect(() => {
    const p1 = setTimeout(() => setPhase(1), 900)
    const p2 = setTimeout(() => {
      setPhase(2)
      setTimeout(onDone, 450)
    }, 1800)
    return () => { clearTimeout(p1); clearTimeout(p2) }
  }, [onDone])

  const restaurantName = config?.restaurant.name ?? "ServeHub"
  const tagline = config?.restaurant.tagline ?? t("app.tagline")
  const logo = config?.restaurant.logo
  const primary = config?.branding.primaryColor ?? "#E85D75"
  const accent = config?.branding.accentColor ?? "#FFB7C5"

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white ${phase >= 2 ? "splash-exit" : ""}`}
      style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)` }}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute h-32 w-32 rounded-full bg-white/30 splash-ring" />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-white shadow-2xl splash-pulse">
          {logo ? (
            <img src={logo} alt={restaurantName} className="h-16 w-16 object-contain" />
          ) : (
            <span className="text-5xl font-extrabold" style={{ color: primary }}>
              {restaurantName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-white drop-shadow">
        {restaurantName}
      </h1>
      <p className="mt-2 text-sm font-medium text-white/80">{tagline}</p>

      <div className="mt-10 flex items-center gap-2 text-white/90">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        <span className="text-xs font-medium">
          {phase === 0 ? t("splash.initializing") : t("splash.connecting")}
        </span>
      </div>

      <div className="absolute bottom-6 text-xs font-medium text-white/70">
        ServeHub · Restaurant Operations
      </div>
    </div>
  )
}
