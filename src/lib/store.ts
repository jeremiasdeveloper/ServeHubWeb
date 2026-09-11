"use client"

// ServeHub — global app store (Zustand)

import { create } from "zustand"
import { api, getToken, setToken } from "./api-client"
import type { ServeHubConfig, CurrentUser } from "./types"
import { translations, type Locale, type TranslationKey } from "./i18n"
import { getSavedConnection, isEmbeddedClient, getDesktopServerUrl, ensureDesktopConnection } from "./connection"

export type ViewKey =
  | "dashboard"
  | "orders"
  | "tables"
  | "menu"
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
  // Packaged remote clients (Android) must first pick a restaurant server.
  connectionRequired: boolean
  // First-run setup wizard (no users exist yet).
  setupNeeded: boolean | null
  setupServerId: string | null
  boot: () => Promise<void>

  // auth
  user: CurrentUser | null
  authLoading: boolean
  login: (u: string, p: string) => Promise<void>
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

  // realtime / connectivity
  realtimeConnected: boolean
  setRealtimeConnected: (v: boolean) => void
  // True while the ServeHub server answers health checks. When false the
  // app is in offline read-only mode (writes blocked by api-client).
  serverReachable: boolean
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

// Factory so that changing locale produces a NEW `t` reference — every
// component subscribed to `s.t` re-renders when the language changes.
function makeT(locale: Locale) {
  return (key: TranslationKey, vars?: Record<string, string | number>) => {
    const dict = translations[locale] || translations.es
    const tmpl = (dict as Record<string, string>)[key] ?? (translations.es as Record<string, string>)[key] ?? key
    return interpolate(tmpl, vars)
  }
}

export const useApp = create<AppState>((set) => ({
  booted: false,
  config: null,
  bootError: null,
  connectionRequired: false,
  setupNeeded: null,
  setupServerId: null,
  boot: async () => {
    // Packaged remote client (Android) without a saved server connection:
    // show the connection screen first — there is no API to talk to yet.
    if (isEmbeddedClient() && !getSavedConnection()) {
      // Windows desktop shell: auto-connect to its own embedded server.
      if (getDesktopServerUrl()) {
        const ok = await ensureDesktopConnection()
        if (!ok) {
          set({ booted: true, connectionRequired: true, config: null, bootError: null })
          return
        }
      } else {
        set({ booted: true, connectionRequired: true, config: null, bootError: null })
        return
      }
    }
    try {
      const config = await api.config()
      if (config.server?.realtimePort && typeof window !== "undefined") {
        const { storeRealtimePort } = await import("./connection")
        storeRealtimePort(config.server.realtimePort)
      }
      // First-run setup check (only meaningful when no users exist).
      let setupNeeded: boolean | null = null
      let setupServerId: string | null = null
      try {
        const status = await api.setupStatus()
        setupNeeded = status.needsSetup
        setupServerId = status.serverId
      } catch {}
      set({
        config,
        booted: true,
        bootError: null,
        connectionRequired: false,
        setupNeeded,
        setupServerId,
      })
    } catch (e) {
      set({
        booted: true,
        bootError: e instanceof Error ? e.message : "boot failed",
        connectionRequired: false,
      })
    }
  },

  user: null,
  authLoading: true,
  login: async (username, password) => {
    const { user, token } = await api.login(username, password)
    setToken(token)
    set({ user })
  },
  logout: async () => {
    try { await api.logout() } catch {}
    setToken(null)
    // tear down the realtime socket (lazy import to avoid cycles)
    const { releaseSocket } = await import("./use-realtime")
    releaseSocket()
    set({ user: null, view: "dashboard", realtimeConnected: false })
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
    set({ locale: l, t: makeT(l) })
    if (typeof window !== "undefined") window.localStorage.setItem("servehub_locale", l)
  },
  t: makeT("es"),

  view: "dashboard",
  setView: (v) => set({ view: v }),

  devMode: false,
  toggleDev: () => set((s) => ({ devMode: !s.devMode })),
  mobilePreview: false,
  toggleMobilePreview: () => set((s) => ({ mobilePreview: !s.mobilePreview })),

  realtimeConnected: false,
  setRealtimeConnected: (v) => set({ realtimeConnected: v }),

  serverReachable: true,
}))

// Initialize locale from localStorage on client
if (typeof window !== "undefined") {
  const saved = window.localStorage.getItem("servehub_locale") as Locale | null
  if (saved === "es" || saved === "en") useApp.setState({ locale: saved, t: makeT(saved) })

  // Session expired / revoked anywhere in the app → return to the login
  // screen gracefully (the api-client clears the token before emitting).
  window.addEventListener("servehub:unauthorized", () => {
    useApp.setState({ user: null, view: "dashboard", authLoading: false })
  })
}

// Helper hook for components
export function useT() {
  return useApp((s) => s.t)
}
