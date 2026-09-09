// ServeHub — Order workflow state machine

export const ORDER_STATUSES = [
  "DRAFT",
  "SENT",
  "RECEIVED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Allowed forward transitions.
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
}

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to)
}

export function nextStatuses(from: string): string[] {
  return TRANSITIONS[from] ?? []
}

// Which permission is required to perform a given transition.
export const TRANSITION_PERMISSIONS: Record<string, string> = {
  "DRAFT->SENT": "orders.send",
  "SENT->RECEIVED": "orders.prepare",
  "RECEIVED->PREPARING": "orders.prepare",
  "PREPARING->READY": "orders.ready",
  "READY->DELIVERED": "orders.deliver",
  "DELIVERED->COMPLETED": "orders.complete",
  "DRAFT->CANCELLED": "orders.cancel",
  "SENT->CANCELLED": "orders.cancel",
  "RECEIVED->CANCELLED": "orders.cancel",
  "PREPARING->CANCELLED": "orders.cancel",
  "READY->CANCELLED": "orders.cancel",
}

export const ORDER_STATUS_LABELS_ES: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  RECEIVED: "Recibida",
  PREPARING: "Preparando",
  READY: "Lista",
  DELIVERED: "Entregada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
}

export const ORDER_STATUS_LABELS_EN: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  RECEIVED: "Received",
  PREPARING: "Preparing",
  READY: "Ready",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const TABLE_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "NEEDS_CLEANING"] as const

export const TABLE_STATUS_LABELS_ES: Record<string, string> = {
  AVAILABLE: "Disponible",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
  NEEDS_CLEANING: "Necesita limpieza",
}

export const COMPLAINT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
