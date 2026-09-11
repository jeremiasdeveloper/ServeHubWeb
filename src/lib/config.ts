// ServeHub — runtime restaurant configuration (JSON-driven)
// Single source of truth for restaurant name, branding, fonts, feature flags
// and localization defaults. The frontend reads it via /api/config (public).
//
// Persistence: the full config object is stored as JSON under the
// `servehub_config` key in restaurant_settings. getConfig() merges the
// stored object over the defaults, so any field not yet persisted keeps
// its default value (forward-compatible schema evolution).

import { db } from "./db"

export interface ServeHubConfig {
  restaurant: {
    name: string
    id: string
    logo: string | null
    tagline?: string
  }
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
  }
  appearance: {
    font: string
  }
  features: {
    orders: boolean
    employees: boolean
    complaints: boolean
    customerService: boolean
    chat: boolean
    attendance: boolean
    tables: boolean
    menu: boolean
    notifications: boolean
  }
  localization: {
    defaultLanguage: "es" | "en"
    supportedLanguages: ("es" | "en")[]
  }
  server: {
    realtimePort: number
    version: string
  }
}

// Bundled UI fonts (self-hosted; no external Google Fonts at runtime).
// Keys map to CSS font families registered in the branding injector.
export const SUPPORTED_FONTS = [
  { id: "inter", label: "Inter", family: "var(--font-inter)" },
  { id: "manrope", label: "Manrope", family: "var(--font-manrope)" },
  { id: "poppins", label: "Poppins", family: "var(--font-poppins)" },
  { id: "jakarta", label: "Plus Jakarta Sans", family: "var(--font-jakarta)" },
  { id: "nunito", label: "Nunito Sans", family: "var(--font-nunito)" },
  { id: "dmsans", label: "DM Sans", family: "var(--font-dmsans)" },
] as const

export function fontFamilyFor(id: string): string {
  return SUPPORTED_FONTS.find((f) => f.id === id)?.family ?? SUPPORTED_FONTS[0].family
}

// Neutral factory defaults. Real values are configured during first-run
// setup and persisted to the database — nothing restaurant-specific here.
export const DEFAULT_CONFIG: ServeHubConfig = {
  restaurant: {
    name: "ServeHub",
    id: "",
    logo: null,
    tagline: "Operaciones de restaurante en tiempo real",
  },
  branding: {
    primaryColor: "#E85D75",
    secondaryColor: "#FFFFFF",
    accentColor: "#FFB7C5",
  },
  appearance: {
    font: "inter",
  },
  features: {
    orders: true,
    employees: true,
    complaints: true,
    customerService: true,
    chat: true,
    attendance: true,
    tables: true,
    menu: true,
    notifications: true,
  },
  localization: {
    defaultLanguage: "es",
    supportedLanguages: ["es", "en"],
  },
  server: {
    realtimePort: 3003,
    version: "1.0.0",
  },
}

const CONFIG_KEY = "servehub_config"

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base
  if (Array.isArray(base) || typeof base !== "object") return override as T
  if (typeof override !== "object" || Array.isArray(override)) return override as T
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (k in (base as Record<string, unknown>)) {
      out[k] = deepMerge((base as Record<string, unknown>)[k], v)
    }
  }
  return out as T
}

export async function getConfig(): Promise<ServeHubConfig> {
  try {
    const row = await db.restaurantSetting.findUnique({ where: { key: CONFIG_KEY } })
    if (!row) return DEFAULT_CONFIG
    return deepMerge(DEFAULT_CONFIG, JSON.parse(row.value))
  } catch {
    return DEFAULT_CONFIG
  }
}

// Persist a partial config (deep-merged over the current stored value).
export async function saveConfig(patch: unknown): Promise<ServeHubConfig> {
  const current = await getConfig()
  const next = deepMerge(current, patch)
  await db.restaurantSetting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: CONFIG_KEY, value: JSON.stringify(next) },
  })
  return next
}
