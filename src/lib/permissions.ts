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
  "orders.receive",
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
  "roles.create",
  "roles.edit",

  // menu
  "menu.view",
  "menu.create",
  "menu.edit",
  "menu.disable",

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

  // audit / backup
  "audit.view",
  "backup.create",
  "backup.restore",

  // developer / admin
  "admin.access",
  "developer.access",
] as const

export type Permission = (typeof PERMISSIONS)[number]

// Default permission sets per system role (Spanish names). English aliases
// are kept so databases created by older builds keep resolving defaults.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Administrador: [...PERMISSIONS],
  Gerente: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.send", "orders.receive", "orders.ready", "orders.deliver", "orders.complete", "orders.cancel",
    "employees.view", "employees.create", "employees.edit",
    "roles.view",
    "menu.view", "menu.create", "menu.edit", "menu.disable",
    "complaints.view", "complaints.create", "complaints.resolve",
    "customerService.view", "customerService.manage",
    "chat.view", "chat.send",
    "attendance.view", "attendance.edit",
    "tables.view", "tables.edit",
    "notifications.view",
    "settings.view",
    "audit.view",
    "admin.access",
  ],
  Supervisor: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.send", "orders.ready", "orders.deliver",
    "employees.view",
    "menu.view",
    "complaints.view", "complaints.create",
    "chat.view", "chat.send",
    "attendance.view",
    "tables.view",
    "notifications.view",
  ],
  Mesero: [
    "dashboard.view",
    "orders.view", "orders.create", "orders.edit", "orders.send", "orders.deliver",
    "menu.view",
    "chat.view", "chat.send",
    "attendance.self",
    "tables.view",
    "notifications.view",
    "complaints.create",
  ],
  Cocina: [
    "dashboard.view",
    "orders.view", "orders.receive", "orders.prepare", "orders.ready",
    "menu.view",
    "chat.view", "chat.send",
    "attendance.self",
    "notifications.view",
  ],
  Cajero: [
    "dashboard.view",
    "orders.view", "orders.complete",
    "menu.view",
    "chat.view", "chat.send",
    "attendance.self",
    "tables.view",
    "notifications.view",
    "complaints.create",
  ],
  Empleado: [
    "dashboard.view",
    "chat.view", "chat.send",
    "attendance.self",
    "notifications.view",
  ],

}

// Legacy English-name fallbacks for databases created by older builds.
// ("Supervisor" is spelled the same in both languages.)
Object.assign(ROLE_PERMISSIONS, {
  Administrator: [...PERMISSIONS],
  Manager: ROLE_PERMISSIONS["Gerente"],
  "Kitchen Staff": ROLE_PERMISSIONS["Cocina"],
  Waiter: ROLE_PERMISSIONS["Mesero"],
  Cashier: ROLE_PERMISSIONS["Cajero"],
  Employee: ROLE_PERMISSIONS["Empleado"],
})

export function getRolePermissions(roleName: string): string[] {
  return ROLE_PERMISSIONS[roleName] ?? []
}
