# ServeHub — Roles & Permissions

Permission-based access control (PBAC). A **permission catalog** (`src/lib/permissions.ts`) defines every capability; **roles** group permissions; **users** get the union of their role's permissions plus optional per-user overrides. Permissions are enforced **server-side on every request** and mirrored in the UI to filter navigation and actions.

## System roles

| Role | Purpose | Users (seed) |
|---|---|---|
| Administrator | Full access incl. developer mode and role editing | `admin` |
| Manager | Operational management: orders, staff, complaints, CS, attendance, settings | `manager01` |
| Supervisor | Shift supervision: order floor operations, read-mostly staff views | — (no seeded user) |
| Waiter | Takes orders, sends them, delivers when ready | `waiter01`, `waiter02` |
| Kitchen Staff | Receives and prepares orders, marks them ready | `kitchen01` |
| Cashier | Completes (bills) orders | `cashier01` |
| Employee | Baseline: dashboard, chat, self attendance, notifications | — |

All roles are seeded with `isSystem: true` and cannot be deleted. Demo password: `0000` ([development.md](development.md)).

## Permission catalog

Defined as the `PERMISSIONS` const array in `src/lib/permissions.ts` (31 keys):

| Module | Permissions |
|---|---|
| Dashboard | `dashboard.view` |
| Orders | `orders.view` · `orders.create` · `orders.edit` · `orders.send` · `orders.prepare` · `orders.ready` · `orders.deliver` · `orders.complete` · `orders.cancel` |
| Employees | `employees.view` · `employees.create` · `employees.edit` · `employees.disable` |
| Roles | `roles.view` · `roles.edit` |
| Complaints | `complaints.view` · `complaints.create` · `complaints.resolve` |
| Customer service | `customerService.view` · `customerService.manage` |
| Chat | `chat.view` · `chat.send` |
| Attendance | `attendance.view` · `attendance.edit` · `attendance.self` |
| Tables | `tables.view` · `tables.edit` |
| Notifications | `notifications.view` |
| Settings | `settings.view` · `settings.edit` |
| Admin / developer | `admin.access` · `developer.access` |

## Default role → permission matrix

`ROLE_PERMISSIONS` (source of truth for the seed and for per-request enforcement):

| Permission | Admin | Manager | Supervisor | Waiter | Kitchen | Cashier | Employee |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `orders.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `orders.create` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `orders.edit` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `orders.send` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `orders.prepare` | ✅ | — | — | — | ✅ | — | — |
| `orders.ready` | ✅ | ✅ | — | — | ✅ | — | — |
| `orders.deliver` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `orders.complete` | ✅ | ✅ | — | — | — | ✅ | — |
| `orders.cancel` | ✅ | ✅ | — | — | — | — | — |
| `employees.view` | ✅ | ✅ | ✅ | — | — | — | — |
| `employees.create` | ✅ | ✅ | — | — | — | — | — |
| `employees.edit` | ✅ | ✅ | — | — | — | — | — |
| `employees.disable` | ✅ | — | — | — | — | — | — |
| `roles.view` | ✅ | ✅ | — | — | — | — | — |
| `roles.edit` | ✅ | — | — | — | — | — | — |
| `complaints.view` | ✅ | ✅ | ✅ | — | — | — | — |
| `complaints.create` | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| `complaints.resolve` | ✅ | ✅ | — | — | — | — | — |
| `customerService.view` | ✅ | ✅ | — | — | — | — | — |
| `customerService.manage` | ✅ | ✅ | — | — | — | — | — |
| `chat.view` / `chat.send` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance.view` | ✅ | ✅ | ✅ | — | — | — | — |
| `attendance.edit` | ✅ | ✅ | — | — | — | — | — |
| `attendance.self` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ |
| `tables.view` | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| `tables.edit` | ✅ | ✅ | — | — | — | — | — |
| `notifications.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `settings.view` | ✅ | ✅ | — | — | — | — | — |
| `settings.edit` | ✅ | — | — | — | — | — | — |
| `admin.access` | ✅ | ✅ | — | — | — | — | — |
| `developer.access` | ✅ | — | — | — | — | — | — |

## How permissions are computed

```
effective(user) = unique( rolePermissions(user.role.name)   ← ROLE_PERMISSIONS constant (lib/permissions.ts)
                        ∪ JSON.parse(user.permissions) )    ← per-user extra keys (User.permissions column)
```

- **Server side** (`src/lib/authz.ts`): `userPermissions`, `hasPermission`, `hasAnyPermission`. Every API handler calls `hasPermission(user, "<perm>")` after `resolveUser(req)` — a missing permission returns `403 {"error":"No autorizado"}`.
- **Client side** (`src/lib/use-permissions.ts`): `can(perm)`, `any(...perms)`, `isAdmin` (= `admin.access`), `isDeveloper` (= `developer.access`). The shell filters `NAV_ITEMS` by `can(item.perm)` **and** the config feature flag ([configuration.md](configuration.md)); views also hide individual buttons (e.g. transition buttons) with `can()`.
- **Per-user overrides**: `POST/PATCH /api/employees` can set the `permissions` JSON to grant extra keys to a specific user without changing their role.
- **Admin login gate**: `admin.access` triggers the 10-second "Cuidado con lo que haces" confirmation before the session activates (login screen → `pendingAdmin` in the store).

### Enforcement vs. editable role records (MVP caveat)

The **Roles** view (`PATCH /api/roles/[id]`) persists a permissions JSON on each `Role` row, and `GET /api/auth/login` returns those persisted permissions to the client. However, **per-request server enforcement reads the built-in `ROLE_PERMISSIONS` defaults**, not the edited database record (see `authz.ts` → `getRolePermissions(roleName)`). In this MVP the two are kept identical by the seed, but if you edit a role in the UI, only the *client-side* nav changes until the constant (or the authz lookup) is updated. Known limitation — see [security.md](security.md).

## Role management API

- `GET /api/roles` (`roles.view`) — roles with parsed `permissions`, `userCount`, the full catalog, and `defaults` (the `ROLE_PERMISSIONS` map).
- `PATCH /api/roles/[id]` (`roles.edit`) — body `{ permissions?: string[], description?, name? }`; writes an audit log entry. Role creation/deletion endpoints do not exist in the MVP; roles are managed by the seed.

## Cross references

- Per-transition order permissions: [orders.md](orders.md) · API permission table: [api.md](api.md)
- Storage model (`Role.permissions`, `User.permissions`): [database.md](database.md)
