# ServeHub — API Reference

REST API implemented as Next.js Route Handlers under `src/app/api/**`. All handlers return JSON. Errors use `{ "error": "message" }` with an appropriate HTTP status (messages are Spanish, matching the default UI locale).

## Conventions

- **Base URL** — `http://<host>:81/api` through the Caddy gateway, or `http://localhost:3000/api` directly.
- **Authentication** — every route except `/api/config` and `/api/health` requires a session token. Send it as `Authorization: Bearer <token>`; the server also accepts the HttpOnly cookie `servehub_token` (checked first by `extractToken` in `src/lib/auth.ts`).
- **Permissions** — each handler checks one permission (or a small OR-set) via `hasPermission` (`src/lib/authz.ts`). Effective permissions = role permission set + per-user `permissions` override. See [roles-and-permissions.md](roles-and-permissions.md).
- **IDs** — Prisma `cuid()` strings.
- **List limits** — orders/complaints/customer-service: 200; messages: 500; notifications: 100.

## Endpoint reference

| Method | Path | Auth | Permission required |
|---|---|---|---|
| GET | `/api/config` | — | public |
| GET | `/api/health` | — | public |
| POST | `/api/auth/login` | — | public |
| POST | `/api/auth/logout` | token | — |
| GET | `/api/auth/me` | ✅ | — |
| GET | `/api/orders` | ✅ | `orders.view` |
| POST | `/api/orders` | ✅ | `orders.create` |
| GET | `/api/orders/[id]` | ✅ | `orders.view` |
| POST | `/api/orders/[id]/transition` | ✅ | per-transition (see [orders.md](orders.md)) |
| GET | `/api/tables` | ✅ | `tables.view` |
| POST | `/api/tables` | ✅ | `tables.edit` |
| PATCH | `/api/tables/[id]` | ✅ | `tables.edit` |
| DELETE | `/api/tables/[id]` | ✅ | `tables.edit` |
| GET | `/api/employees` | ✅ | `employees.view` |
| POST | `/api/employees` | ✅ | `employees.create` |
| PATCH | `/api/employees/[id]` | ✅ | `employees.edit` |
| DELETE | `/api/employees/[id]` | ✅ | `employees.disable` (soft-disable, sets `active=false`) |
| GET | `/api/roles` | ✅ | `roles.view` |
| PATCH | `/api/roles/[id]` | ✅ | `roles.edit` |
| GET | `/api/complaints` | ✅ | `complaints.view` |
| POST | `/api/complaints` | ✅ | `complaints.create` |
| PATCH | `/api/complaints/[id]` | ✅ | `complaints.resolve` |
| GET | `/api/customer-service` | ✅ | `customerService.view` |
| POST | `/api/customer-service` | ✅ | `customerService.manage` |
| PATCH | `/api/customer-service/[id]` | ✅ | `customerService.manage` |
| GET | `/api/chat/conversations` | ✅ | `chat.view` |
| POST | `/api/chat/conversations` | ✅ | `chat.send` |
| GET | `/api/chat/conversations/[id]/messages` | ✅ | `chat.view` + participant |
| POST | `/api/chat/messages` | ✅ | `chat.send` + participant |
| GET | `/api/attendance` | ✅ | `attendance.view` |
| POST | `/api/attendance` | ✅ | `attendance.self` **or** `attendance.edit` |
| GET | `/api/notifications` | ✅ | `notifications.view` |
| PATCH | `/api/notifications` | ✅ | — (marks own notifications read) |
| PATCH | `/api/notifications/[id]` | ✅ | — (owner-scoped) |
| GET | `/api/settings` | ✅ | `settings.view` |
| PATCH | `/api/settings` | ✅ | `settings.edit` |
| GET | `/api/developer` | ✅ | `developer.access` |

Status codes: `200` ok · `201` created · `400` validation (`JSON inválido`, missing fields) · `401` unauthenticated · `403` unauthorized / not a participant · `404` not found · `409` duplicate (`El usuario ya existe`, `Esa mesa ya existe`).

---

## Auth

### `POST /api/auth/login`

```json
// Request
{ "username": "admin", "password": "0000" }
```

```json
// 200 Response (also sets HttpOnly cookie servehub_token)
{
  "user": {
    "id": "cm…", "username": "admin", "displayName": "Administrador",
    "email": "admin@cafesakura.test",
    "role": { "id": "cm…", "name": "Administrator" },
    "permissions": ["dashboard.view", "orders.view", "…"],
    "isAdmin": true
  },
  "token": "64-hex-char session token"
}
```

- `401 { "error": "Credenciales inválidas" }` on unknown user, inactive user, or wrong password (no distinction is exposed).
- Effective permission list = role record's `permissions` JSON ∪ user record's `permissions` JSON. An audit log entry `LOGIN` is written.

### `GET /api/auth/me`

```json
// 200
{ "user": { "id": "cm…", "username": "waiter01", "role": { "id": "cm…", "name": "Waiter" },
            "permissions": ["…"], "isAdmin": false, "active": true } }
// 401 (no/invalid/expired token)
{ "user": null }
```

### `POST /api/auth/logout`

```json
// 200 — destroys the Session row and clears the cookie
{ "ok": true }
```

---

## Orders

Full workflow rules, transition permissions and side effects: [orders.md](orders.md).

### `GET /api/orders?status=SENT&mine=1`

Both query params optional. `mine=1` filters to orders assigned to the caller. Returns the 200 most recent:

```json
{ "orders": [ {
  "id": "cm…", "number": 1041, "status": "PREPARING",
  "table": { "id": "cm…", "number": "02", "status": "OCCUPIED" },
  "createdBy": { "id": "cm…", "username": "waiter01", "displayName": "Waiter01" },
  "assignedTo": { "id": "cm…", "username": "kitchen01", "displayName": "Kitchen01" },
  "notes": "Sin cebolla en el ramen", "total": 23.5,
  "createdAt": "2025-01-01T12:00:00.000Z", "updatedAt": "…",
  "items": [ { "id": "cm…", "name": "Ramen de Pollo", "quantity": 2, "price": 8.5,
               "notes": "sin cebolla", "status": "PENDING" } ]
} ] }
```

### `POST /api/orders`

```json
// Request — items required (non-empty); send:true creates directly in SENT
{
  "tableId": "cm…",
  "items": [ { "name": "Ramen de Pollo", "quantity": 2, "price": 8.5, "notes": "sin cebolla" } ],
  "notes": "Cliente con prisa",
  "send": true
}
```

```json
// 201 Response
{ "order": { "id": "cm…", "number": 1046, "status": "SENT", "total": 17.0, "…": "…" } }
```

Server-side behavior: order number = (max existing number, base 1040) + 1; `total` is computed from `price × quantity` (client values are not trusted); an `OrderStatusHistory` entry is created; if `send` is true the history also records `DRAFT→SENT`, the table flips to `OCCUPIED`, a realtime `order.created` is emitted and every active **Kitchen Staff** user gets a `NEW_ORDER` notification + `notification.created` realtime event. Audit log `ORDER_CREATE`.

### `GET /api/orders/[id]`

Same shape as list items, plus `history` (ascending):

```json
{ "order": { "…": "…", "history": [
  { "fromStatus": null, "toStatus": "DRAFT", "changedById": "cm…", "note": null, "createdAt": "…" },
  { "fromStatus": "DRAFT", "toStatus": "SENT", "changedById": "cm…", "note": null, "createdAt": "…" }
] } }
```

### `POST /api/orders/[id]/transition`

```json
// Request
{ "to": "READY", "note": "Platos emplatados" }
```

```json
// 200
{ "order": { "id": "cm…", "number": 1041, "status": "READY", "…": "…" } }
// 400 invalid transition
{ "error": "Transición inválida: DRAFT → READY. Válidas: SENT, CANCELLED" }
// 403 missing permission
{ "error": "Sin permiso para esta acción (orders.ready)" }
```

Side effects by target status: `RECEIVED`/`PREPARING` auto-assign the order to the caller if unassigned; `READY` notifies the assignee (or creator) with `ORDER_READY` + realtime `order.ready`; `DELIVERED` emits `order.delivered`; `COMPLETED`/`CANCELLED` set the table to `NEEDS_CLEANING`. Every transition writes history + audit log and emits `order.updated`.

---

## Tables

### `GET /api/tables`

```json
{ "tables": [ { "id": "cm…", "number": "01", "capacity": 4, "status": "AVAILABLE",
                "location": "Salón principal",
                "orders": [ { "id": "cm…", "number": 1041, "status": "PREPARING" } ] } ],
  "statuses": ["AVAILABLE", "OCCUPIED", "RESERVED", "NEEDS_CLEANING"] }
```

`orders` contains at most the latest **active** order (status in DRAFT…DELIVERED).

### `POST /api/tables` / `PATCH /api/tables/[id]`

```json
// POST request
{ "number": "13", "capacity": 6, "location": "Terraza" }        // 201 { "table": { … } }
// PATCH request (all optional)
{ "status": "AVAILABLE", "capacity": 2, "location": "Barra", "number": "13" }
// DELETE /api/tables/[id] → { "ok": true }
```

---

## Chat

### `GET /api/chat/conversations`

Conversations where the caller is a participant, each with participants and the latest message:

```json
{ "conversations": [ {
  "id": "cm…", "name": "Chat general", "isGroup": true,
  "participants": [ { "id": "cm…", "user": { "id": "cm…", "username": "admin", "displayName": "Administrador" }, "lastReadAt": "…" } ],
  "messages": [ { "id": "cm…", "content": "Recuerden marcar órdenes listas a tiempo.",
                  "sender": { "id": "cm…", "username": "admin", "displayName": "Administrador" },
                  "createdAt": "…" } ],
  "updatedAt": "…" } ] }
```

### `POST /api/chat/conversations`

```json
{ "participantIds": ["cm-user-2"], "name": null, "isGroup": false }
// 201 { "conversation": { … } }
```

Requires ≥ 2 participants (caller is added automatically). 1:1 conversations are de-duplicated — an existing conversation with exactly the same two participants is returned instead of creating a new one.

### `GET /api/chat/conversations/[id]/messages`

Requires the caller to be a participant (`403 "No tienes acceso a esta conversación"` otherwise). Returns up to 500 messages ascending and updates the caller's `lastReadAt`:

```json
{ "messages": [ { "id": "cm…", "content": "Buenos días equipo, turno iniciado.",
                  "sender": { "id": "cm…", "username": "manager01", "displayName": "Manager01" },
                  "createdAt": "…" } ] }
```

### `POST /api/chat/messages`

```json
// Request
{ "conversationId": "cm…", "content": "Mesa 05 pide la cuenta" }
// 201
{ "message": { "id": "cm…", "content": "Mesa 05 pide la cuenta",
               "sender": { "id": "cm…", "username": "waiter01", "displayName": "Waiter01" },
               "createdAt": "…" } }
```

Side effects: other participants each get a `NEW_MESSAGE` notification + `notification.created` realtime event; a `message.created` realtime event is broadcast so open chat views refresh.

---

## Attendance

### `GET /api/attendance?date=YYYY-MM-DD`

Defaults to today (UTC). Requires `attendance.view`:

```json
{ "records": [ { "id": "cm…", "date": "2025-01-01",
                 "checkIn": "…", "checkOut": null, "status": "PRESENT", "notes": null,
                 "user": { "id": "cm…", "username": "waiter01", "displayName": "Waiter01",
                           "role": { "name": "Waiter" } } } ],
  "date": "2025-01-01" }
```

### `POST /api/attendance`

```json
{ "action": "in" }   // or { "action": "out" }
// 200 { "record": { "id": "cm…", "checkIn": "…", "checkOut": null, "status": "PRESENT", "…": "…" } }
// 400 "Ya registraste entrada hoy" | "No has registrado entrada hoy" | "Ya registraste salida hoy"
```

- `in` → 400 `"Ya registraste entrada hoy"` if a check-in exists; otherwise upserts `checkIn` and sets status `PRESENT`.
- `out` → 400 `"No has registrado entrada hoy"` / `"Ya registraste salida hoy"` when invalid; otherwise sets `checkOut`.
- One record per user per day (`@@unique([userId, date])`).

---

## Notifications

### `GET /api/notifications?unread=1`

Own notifications only, newest first (max 100) + unread counter:

```json
{ "notifications": [ { "id": "cm…", "type": "ORDER_READY", "title": "Orden lista",
                       "body": "La orden #1041 de la Mesa 04 está lista para entregar.",
                       "data": "{\"orderId\":\"demo\",\"tableNumber\":\"04\"}",
                       "read": false, "createdAt": "…" } ],
  "unread": 2 }
```

### `PATCH /api/notifications` and `PATCH /api/notifications/[id]`

```json
{}  // collection PATCH → mark ALL own notifications read: { "ok": true }
{}  // [id] PATCH → mark one own notification read; 404 if not owned
```

---

## Health & config (public)

### `GET /api/health`

```json
{ "web": "ok", "time": "2025-01-01T12:00:00.000Z",
  "database": "ok", "realtime": "ok" }
```

`realtime` probes the bridge at `localhost:3004/health`: `ok` / `degraded` / `offline`. `database` runs a `user.count()` probe.

### `GET /api/config`

Public. Returns the restaurant config enriched with row counts used by the splash screen:

```json
{ "restaurant": { "name": "Café Sakura", "id": "cafe_sakura", "logo": null,
                  "tagline": "Operaciones de restaurante en tiempo real" },
  "branding": { "primaryColor": "#E85D75", "secondaryColor": "#FFFFFF", "accentColor": "#FFB7C5" },
  "features": { "orders": true, "employees": true, "complaints": true, "customerService": true,
                "chat": true, "attendance": true, "tables": true, "notifications": true },
  "localization": { "defaultLanguage": "es", "supportedLanguages": ["es", "en"] },
  "server": { "realtimePort": 3003, "version": "1.0.0-mvp" },
  "counts": { "users": 6, "tables": 12, "orders": 5 } }
```

Field reference: [configuration.md](configuration.md).

---

## Employees, roles, complaints, customer service, settings, developer

### Employees

- `GET /api/employees` → `{ "employees": [User… (no passwordHash), plus `role`, `permissions`], "roles": [Role…] }`
- `POST` body `{ username, displayName, email?, roleId, password }` — username lowercased, password Argon2-hashed; `409` on duplicate.
- `PATCH /api/employees/[id]` body `{ displayName?, email?, roleId?, active?, password? }` — `password` is re-hashed.
- `DELETE /api/employees/[id]` — **soft disable** (`active: false`) to preserve referential integrity.

### Roles

- `GET /api/roles` → `{ "roles": [ { …role, "permissions": [keys], "userCount": n } ], "permissions": [full catalog], "defaults": { "Administrator": […], … } }` — `defaults` mirrors `ROLE_PERMISSIONS` from `src/lib/permissions.ts`.
- `PATCH /api/roles/[id]` body `{ permissions?: string[], description?, name? }` — persists the permission JSON on the role record. Note: per-request server enforcement reads the built-in defaults; see the caveat in [roles-and-permissions.md](roles-and-permissions.md).

### Complaints

- `GET /api/complaints?status=OPEN` → `{ "complaints": […] }` with `createdBy`/`assignedTo` summaries.
- `POST` body `{ title, description, category?, priority?, customerName? }` → `201`. Categories: `GENERAL | SERVICE | FOOD | WAIT_TIME | BILLING | OTHER`; priorities: `LOW | NORMAL | HIGH | URGENT`; created as `OPEN`.
- `PATCH /[id]` body `{ status?, assignedToId?, priority?, resolution? }` — requires `complaints.resolve`; assigning to another user creates a `COMPLAINT_ASSIGNED` notification + realtime event. Statuses: `OPEN | IN_PROGRESS | RESOLVED | CLOSED`.

### Customer service

- `GET /api/customer-service` → `{ "items": […] }`. Model fields: `subject, description, channel (IN_PERSON|PHONE|EMAIL|ONLINE), customerName, customerContact, status (OPEN|IN_PROGRESS|RESOLVED|CLOSED), assignedToId`.
- `POST` body `{ subject, description, channel?, customerName?, customerContact? }` → `201`.
- `PATCH /[id]` body `{ status?, assignedToId?, subject?, description? }`.

### Settings

Key/value store persisted in `RestaurantSetting`:

```json
// GET → { "settings": { "restaurant_name": "Café Sakura", "restaurant_id": "cafe_sakura" } }
// PATCH body (any number of keys) → { "ok": true }
{ "restaurant_name": "Café Sakura", "waiter_call_sound": "on" }
```

### Developer

`GET /api/developer` (requires `developer.access`) — powers the F10 panel:

```json
{ "config": { … }, "permissions": [full catalog],
  "counts": { "user": 6, "role": 7, "order": 5, "…": "…" },
  "realtime": { "ok": true, "service": "servehub-realtime", "clients": 2 },
  "roles": [ { "name": "Administrator", "permissions": ["…"] } ],
  "environment": { "nodeEnv": "development", "runtime": "Next.js 16 (App Router)",
                   "database": "SQLite via Prisma", "realtimeService": "socket.io @ port 3003",
                   "serverTime": "…" } }
```

The UI's "re-seed" button is informational only (it suggests running `bun run scripts/seed.ts`); there is no POST handler on this route.
