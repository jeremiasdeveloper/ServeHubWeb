// ServeHub — runtime restaurant configuration (JSON-driven)
// This is the single source of truth for restaurant name, branding, feature flags,
// localization defaults. The frontend reads it via /api/config (public).

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
  features: {
    orders: boolean
    employees: boolean
    complaints: boolean
    customerService: boolean
    chat: boolean
    attendance: boolean
    tables: boolean
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

// Default demo configuration — Cafe Sakura
export const DEFAULT_CONFIG: ServeHubConfig = {
  restaurant: {
    name: "Café Sakura",
    id: "cafe_sakura",
    logo: null,
    tagline: "Operaciones de restaurante en tiempo real",
  },
  branding: {
    primaryColor: "#E85D75",
    secondaryColor: "#FFFFFF",
    accentColor: "#FFB7C5",
  },
  features: {
    orders: true,
    employees: true,
    complaints: true,
    customerService: true,
    chat: true,
    attendance: true,
    tables: true,
    notifications: true,
  },
  localization: {
    defaultLanguage: "es",
    supportedLanguages: ["es", "en"],
  },
  server: {
    realtimePort: 3003,
    version: "1.0.0-mvp",
  },
}

// Allow runtime override via restaurant_settings table (key=servehub_config).
// For the MVP we keep it simple: a static config is exposed publicly.
export function getConfig(): ServeHubConfig {
  return DEFAULT_CONFIG
}
