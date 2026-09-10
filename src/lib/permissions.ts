// ServeHub — Permission catalog
// Central list of all permission keys used across the backend & UI.

export const PERMISSIONS = [
  // dashboard
  "dashboard.view",

  // orders
  "orders.view",
  "orders.create",
  "orders.edit",
  "orders.send",
  "orders.prepare",
  "orders.ready",
  "orders.deliver",
  "orders.complete",
  "orders.cancel",

  // employees
  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.disable",

  // roles
  "roles.view",
  "roles.edit",

  // complaints
  "complaints.view",
  "complaints.create",
  "complaints.resolve",

  // customer service
  "customerService.view",
  "customerService.manage",

  // chat
  "chat.view",
  "chat.send",

  // attendance
  "attendance.view",
  "attendance.edit",
  "attendance.self",

  // tables
  "tables.view",
  "tables.edit",

  // notifications
  "notifications.view",

  // settings
  "settings.view",
  "settings.edit",

  // developer / admin
  "admin.access",
  "developer.access",
] as const

export type Permission = (typeof PERMISSIONS)[number]

// Default permission sets per system role.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Administrator: [...PERMISSIONS],
  Manager: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.send", "orders.ready", "orders.deliver", "orders.complete", "orders.cancel",
    "employees.view", "employees.create", "employees.edit",
    "roles.view",
    "complaints.view", "complaints.create", "complaints.resolve",
    "customerService.view", "customerService.manage",
    "chat.view", "chat.send",
    "attendance.view", "attendance.edit",
    "tables.view", "tables.edit",
    "notifications.view",
    "settings.view",
    "admin.access",
  ],
  Supervisor: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.send", "orders.ready", "orders.deliver",
    "employees.view",
    "complaints.view", "complaints.create",
    "chat.view", "chat.send",
    "attendance.view",
    "tables.view",
    "notifications.view",
  ],
  Waiter: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.send", "orders.deliver",
    "chat.view", "chat.send",
    "attendance.self",
    "tables.view",
    "notifications.view",
    "complaints.create",
  ],
  "Kitchen Staff": [
    "dashboard.view",
    "orders.view", "orders.prepare", "orders.ready",
    "chat.view", "chat.send",
    "attendance.self",
    "notifications.view",
  ],
  Cashier: [
    "dashboard.view",
    "orders.view", "orders.complete",
    "chat.view", "chat.send",
    "attendance.self",
    "tables.view",
    "notifications.view",
    "complaints.create",
  ],
  Employee: [
    "dashboard.view",
    "chat.view", "chat.send",
    "attendance.self",
    "notifications.view",
  ],
}

export function getRolePermissions(roleName: string): string[] {
  return ROLE_PERMISSIONS[roleName] ?? []
}
