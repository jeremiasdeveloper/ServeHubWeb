// ServeHub — frontend API client
import { getApiBase } from "./connection"
import type {
  ServeHubConfig,
  MenuCategoryInfo,
  CurrentUser,
  OrderInfo,
  TableInfo,
  EmployeeInfo,
  RoleInfo,
  ComplaintInfo,
  CustomerServiceInfo,
  ConversationInfo,
  MessageInfo,
  AttendanceInfo,
  NotificationInfo,
} from "./types"

// Token is stored in localStorage; cookie is also set by login for SSR-style.
let authToken: string | null = null

export function setToken(token: string | null) {
  authToken = token
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem("servehub_token", token)
    else window.localStorage.removeItem("servehub_token")
  }
}

export function getToken(): string | null {
  if (authToken) return authToken
  if (typeof window !== "undefined") {
    authToken = window.localStorage.getItem("servehub_token")
  }
  return authToken
}

// ---- Offline read-only mode --------------------------------------------------
// While the ServeHub server is unreachable, ALL write operations are blocked
// (read-only mode). Reads keep working with whatever was already loaded in
// the app state. A connectivity monitor sets this flag.
let offlineMode = false

export function setOfflineMode(v: boolean) {
  offlineMode = v
}

export function isOfflineMode(): boolean {
  return offlineMode
}

function offlineWriteMessage(): string {
  let locale = "es"
  try {
    locale = window.localStorage.getItem("servehub_locale") || "es"
  } catch {}
  return locale === "en"
    ? "You are offline. Previously synchronized information is available in read-only mode. Reconnect to continue working."
    : "Estás sin conexión. Tu información sincronizada está disponible en modo solo lectura. Reconéctate para continuar trabajando."
}

// ---- Network resilience -----------------------------------------------------
// Transient failures (server hiccup, proxy idle timeout, laptop sleep, network
// switch) must NOT leave views stuck on a permanent "Failed to fetch" state.
// Every request gets a hard timeout, and idempotent requests are retried
// automatically with backoff before surfacing an error to the UI.
const REQUEST_TIMEOUT_MS = 15000
const MAX_RETRIES = 2

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function isTransientStatus(status: number) {
  // 502/503/504 = gateway/proxy issues where the request never reached the app
  return status === 502 || status === 503 || status === 504
}

function networkErrorMessage(): string {
  // api-client is framework-free; read the locale the store persisted.
  let locale = "es"
  try {
    locale = window.localStorage.getItem("servehub_locale") || "es"
  } catch {}
  return locale === "en"
    ? "Could not reach the server. Check your connection and try again."
    : "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
}

async function apiFetch<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase()
  const idempotent = method === "GET" || method === "HEAD"
  if (offlineMode && !idempotent) {
    throw new ApiError(offlineWriteMessage(), 0)
  }
  const canRetry = attempt < MAX_RETRIES && (idempotent || init?.body === undefined)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const token = getToken()
    const res = await fetch(`${getApiBase()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
      credentials: "include",
    })
    if (isTransientStatus(res.status) && attempt < MAX_RETRIES) {
      await delay(400 * 2 ** attempt)
      return apiFetch<T>(path, init, attempt + 1)
    }
    if (!res.ok) {
      // Surface the server's own error message whenever it provides one.
      let msg = `Error ${res.status}`
      try {
        const j = await res.json()
        msg = j.error || msg
      } catch {}
      if (res.status === 401) {
        // The login endpoint also answers 401 (wrong credentials): in that
        // case the server message must reach the UI and the stored token
        // must NOT be touched. For every other endpoint a 401 means the
        // session expired or was revoked → clear it and let the app return
        // to the login screen gracefully instead of getting stuck.
        if (!path.startsWith("/api/auth/login")) {
          setToken(null)
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("servehub:unauthorized"))
          }
        }
      }
      throw new ApiError(msg, res.status)
    }
    return res.json() as Promise<T>
  } catch (e) {
    if (e instanceof ApiError) throw e
    // Network-level failure (DNS, refused, offline, our timeout abort)
    if (canRetry) {
      await delay(400 * 2 ** attempt)
      return apiFetch<T>(path, init, attempt + 1)
    }
    throw new ApiError(networkErrorMessage(), 0)
  } finally {
    clearTimeout(timer)
  }
}

export class ApiError extends Error {
  status: number
  constructor(msg: string, status: number) {
    super(msg)
    this.status = status
  }
}

// ---- Auth ----
export const api = {
  config: () => apiFetch<ServeHubConfig>("/api/config"),
  health: () => apiFetch<Record<string, unknown>>("/api/health"),
  login: (username: string, password: string) =>
    apiFetch<{ user: CurrentUser; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ user: CurrentUser | null }>("/api/auth/me"),

  // Orders
  orders: (status?: string) => apiFetch<{ orders: OrderInfo[] }>(`/api/orders${status ? `?status=${status}` : ""}`),
  order: (id: string) => apiFetch<{ order: OrderInfo }>(`/api/orders/${id}`),
  createOrder: (data: { tableId: string; items: { name: string; quantity: number; price: number; notes?: string }[]; notes?: string; send?: boolean }) =>
    apiFetch<{ order: OrderInfo }>("/api/orders", { method: "POST", body: JSON.stringify(data) }),
  transitionOrder: (id: string, to: string, note?: string) =>
    apiFetch<{ order: OrderInfo }>(`/api/orders/${id}/transition`, { method: "POST", body: JSON.stringify({ to, note }) }),

  // Tables
  tables: () => apiFetch<{ tables: TableInfo[]; statuses: string[] }>("/api/tables"),
  createTable: (data: { number: string; capacity?: number; location?: string }) =>
    apiFetch<{ table: TableInfo }>("/api/tables", { method: "POST", body: JSON.stringify(data) }),
  updateTable: (id: string, data: Partial<TableInfo>) =>
    apiFetch<{ table: TableInfo }>(`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTable: (id: string) => apiFetch<{ ok: boolean }>(`/api/tables/${id}`, { method: "DELETE" }),

  // Employees
  employees: () => apiFetch<{ employees: EmployeeInfo[]; roles: { id: string; name: string }[] }>("/api/employees"),
  createEmployee: (data: { username: string; displayName: string; email?: string; roleId: string; password: string }) =>
    apiFetch<{ employee: EmployeeInfo }>("/api/employees", { method: "POST", body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: Partial<EmployeeInfo> & { password?: string }) =>
    apiFetch<{ employee: EmployeeInfo }>(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  disableEmployee: (id: string) => apiFetch<{ ok: boolean }>(`/api/employees/${id}`, { method: "DELETE" }),

  // Roles
  roles: () => apiFetch<{ roles: RoleInfo[]; permissions: string[]; defaults: Record<string, string[]> }>("/api/roles"),
  updateRole: (id: string, data: { permissions?: string[]; description?: string }) =>
    apiFetch<{ role: RoleInfo }>(`/api/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Complaints
  complaints: (status?: string) => apiFetch<{ complaints: ComplaintInfo[] }>(`/api/complaints${status ? `?status=${status}` : ""}`),
  createComplaint: (data: { title: string; description: string; category?: string; priority?: string; customerName?: string }) =>
    apiFetch<{ complaint: ComplaintInfo }>("/api/complaints", { method: "POST", body: JSON.stringify(data) }),
  updateComplaint: (id: string, data: Partial<ComplaintInfo>) =>
    apiFetch<{ complaint: ComplaintInfo }>(`/api/complaints/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Customer service
  customerService: () => apiFetch<{ items: CustomerServiceInfo[] }>("/api/customer-service"),
  createCustomerService: (data: { subject: string; description: string; channel?: string; customerName?: string; customerContact?: string }) =>
    apiFetch<{ item: CustomerServiceInfo }>("/api/customer-service", { method: "POST", body: JSON.stringify(data) }),
  updateCustomerService: (id: string, data: Partial<CustomerServiceInfo>) =>
    apiFetch<{ item: CustomerServiceInfo }>(`/api/customer-service/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Chat
  conversations: () => apiFetch<{ conversations: ConversationInfo[] }>("/api/chat/conversations"),
  createConversation: (data: { participantIds: string[]; name?: string; isGroup?: boolean }) =>
    apiFetch<{ conversation: ConversationInfo }>("/api/chat/conversations", { method: "POST", body: JSON.stringify(data) }),
  messages: (conversationId: string) => apiFetch<{ messages: MessageInfo[] }>(`/api/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, content: string) =>
    apiFetch<{ message: MessageInfo }>("/api/chat/messages", { method: "POST", body: JSON.stringify({ conversationId, content }) }),

  // Attendance
  attendance: (date?: string) => apiFetch<{ records: AttendanceInfo[]; date: string }>(`/api/attendance${date ? `?date=${date}` : ""}`),
  checkAction: (action: "in" | "out") => apiFetch<{ record: AttendanceInfo }>("/api/attendance", { method: "POST", body: JSON.stringify({ action }) }),

  // Notifications
  notifications: (unread?: boolean) => apiFetch<{ notifications: NotificationInfo[]; unread: number }>(`/api/notifications${unread ? "?unread=1" : ""}`),
  markAllRead: () => apiFetch<{ ok: boolean }>("/api/notifications", { method: "PATCH" }),
  markRead: (id: string) => apiFetch<{ ok: boolean }>(`/api/notifications/${id}`, { method: "PATCH" }),

  // Settings
  settings: () => apiFetch<{ settings: Record<string, string> }>("/api/settings"),
  updateSettings: (data: Record<string, string>) => apiFetch<{ ok: boolean }>("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),

  // Menu
  menu: () => apiFetch<{ categories: MenuCategoryInfo[] }>("/api/menu"),
  createMenuCategory: (data: { name: string; sortOrder?: number }) =>
    apiFetch<{ category: { id: string } }>("/api/menu/categories", { method: "POST", body: JSON.stringify(data) }),
  updateMenuCategory: (id: string, data: { name?: string; sortOrder?: number; active?: boolean }) =>
    apiFetch<{ ok: boolean }>(`/api/menu/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  createMenuItem: (data: { name: string; categoryId: string; price: number; description?: string }) =>
    apiFetch<{ item: { id: string } }>("/api/menu/items", { method: "POST", body: JSON.stringify(data) }),
  updateMenuItem: (id: string, data: { name?: string; categoryId?: string; price?: number; description?: string | null; available?: boolean; active?: boolean }) =>
    apiFetch<{ ok: boolean }>(`/api/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Setup (first run)
  setupStatus: () => apiFetch<{ needsSetup: boolean; serverId: string }>("/api/setup"),
  completeSetup: (data: {
    restaurant: { name: string; id?: string; logo?: string | null; tagline?: string }
    branding: { primaryColor: string; secondaryColor: string; accentColor: string }
    appearance: { font: string }
    localization: { defaultLanguage: string }
    admin: { username: string; password: string; displayName?: string }
  }) => apiFetch<{ ok: boolean; serverId: string; restaurantId: string }>("/api/setup", { method: "POST", body: JSON.stringify(data) }),
  updateConfig: (patch: Record<string, unknown>) =>
    apiFetch<{ ok: boolean }>("/api/config", { method: "PATCH", body: JSON.stringify(patch) }),

  // Backup
  // GET /api/backup streams a binary file, so it bypasses the JSON client.
  // Restore uploads multipart form data. Both are blocked while offline.
  // Implementation lives below the api object.

  // Developer
  developer: () =>
    apiFetch<{
      config: ServeHubConfig
      permissions: string[]
      counts: Record<string, number>
      realtime: Record<string, unknown>
      roles: { name: string; permissions: string[] }[]
      environment: Record<string, string>
    }>("/api/developer"),
}

// ---- Backup file transfer (binary / multipart) ------------------------------
export async function downloadBackup(): Promise<void> {
  if (offlineMode) throw new ApiError(offlineWriteMessage(), 0)
  const res = await fetch(`${getApiBase()}/api/backup`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
  })
  if (!res.ok) throw new ApiError(`Error ${res.status}`, res.status)
  const blob = await res.blob()
  const match = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = match?.[1] ?? "servehub-backup.db"
  a.click()
  URL.revokeObjectURL(url)
}

export async function restoreBackup(file: File): Promise<{ ok: boolean; note?: string }> {
  if (offlineMode) throw new ApiError(offlineWriteMessage(), 0)
  const form = new FormData()
  form.set("file", file)
  const res = await fetch(`${getApiBase()}/api/backup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  let msg = `Error ${res.status}`
  try {
    const j = await res.json()
    if (j.note) return j
    msg = j.error || msg
  } catch {}
  if (!res.ok) throw new ApiError(msg, res.status)
  return { ok: true }
}
