"use client"

// ServeHub — global app store (Zustand)

import { create } from "zustand"
import { api, getToken, setToken } from "./api-client"
import type { ServeHubConfig, CurrentUser } from "./types"
import { translations, type Locale, type TranslationKey } from "./i18n"

export type ViewKey =
  | "dashboard"
  | "orders"
  | "tables"
  | "employees"
  | "roles"
  | "complaints"
  | "customerService"
  | "chat"
  | "attendance"
  | "notifications"
  | "settings"

interface AppState {
  // bootstrap
  booted: boolean
  config: ServeHubConfig | null
  bootError: string | null
  boot: () => Promise<void>

  // auth
  user: CurrentUser | null
  authLoading: boolean
  pendingAdmin: CurrentUser | null
  login: (u: string, p: string) => Promise<{ needsAdminWarning: boolean }>
  commitPendingAdmin: () => void
  cancelPendingAdmin: () => void
  logout: () => Promise<void>
  refreshMe: () => Promise<void>

  // i18n
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string

  // navigation
  view: ViewKey
  setView: (v: ViewKey) => void

  // developer mode
  devMode: boolean
  toggleDev: () => void
  mobilePreview: boolean
  toggleMobilePreview: () => void

  // realtime
  realtimeConnected: boolean
  setRealtimeConnected: (v: boolean) => void
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

export const useApp = create<AppState>((set, get) => ({
  booted: false,
  config: null,
  bootError: null,
  boot: async () => {
    try {
      const config = await api.config()
      set({ config, booted: true, bootError: null })
    } catch (e) {
      set({ booted: true, bootError: e instanceof Error ? e.message : "boot failed" })
    }
  },

  user: null,
  authLoading: true,
  pendingAdmin: null,
  login: async (username, password) => {
    const { user, token } = await api.login(username, password)
    if (user.isAdmin) {
      // hold the token but don't commit user until the admin warning is acknowledged
      setToken(token)
      set({ pendingAdmin: user })
      return { needsAdminWarning: true }
    }
    setToken(token)
    set({ user })
    return { needsAdminWarning: false }
  },
  commitPendingAdmin: () => {
    const pending = get().pendingAdmin
    if (pending) set({ user: pending, pendingAdmin: null })
  },
  cancelPendingAdmin: () => {
    setToken(null)
    set({ pendingAdmin: null })
  },
  logout: async () => {
    try { await api.logout() } catch {}
    setToken(null)
    // tear down the realtime socket (lazy import to avoid cycles)
    const { releaseSocket } = await import("./use-realtime")
    releaseSocket()
    set({ user: null, pendingAdmin: null, view: "dashboard", realtimeConnected: false })
  },
  refreshMe: async () => {
    if (!getToken()) { set({ user: null, authLoading: false }); return }
    try {
      const { user } = await api.me()
      set({ user, authLoading: false })
    } catch {
      setToken(null)
      set({ user: null, authLoading: false })
    }
  },

  locale: "es",
  setLocale: (l) => {
    set({ locale: l })
    if (typeof window !== "undefined") window.localStorage.setItem("servehub_locale", l)
  },
  t: (key, vars) => {
    const state = get()
    const dict = translations[state.locale] || translations.es
    const tmpl = (dict as Record<string, string>)[key] ?? (translations.es as Record<string, string>)[key] ?? key
    return interpolate(tmpl, vars)
  },

  view: "dashboard",
  setView: (v) => set({ view: v }),

  devMode: false,
  toggleDev: () => set((s) => ({ devMode: !s.devMode })),
  mobilePreview: false,
  toggleMobilePreview: () => set((s) => ({ mobilePreview: !s.mobilePreview })),

  realtimeConnected: false,
  setRealtimeConnected: (v) => set({ realtimeConnected: v }),
}))

// Initialize locale from localStorage on client
if (typeof window !== "undefined") {
  const saved = window.localStorage.getItem("servehub_locale") as Locale | null
  if (saved === "es" || saved === "en") useApp.setState({ locale: saved })
}

// Helper hook for components
export function useT() {
  return useApp((s) => s.t)
}
