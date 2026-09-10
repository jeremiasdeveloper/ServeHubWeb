# ServeHub — Order Workflow

Orders move through a strict state machine implemented in `src/lib/order-state.ts` (`ORDER_STATUSES`, `TRANSITIONS`, `TRANSITION_PERMISSIONS`) and enforced by `POST /api/orders/[id]/transition`. Every transition is validated (graph + permission), recorded in `OrderStatusHistory`, audited and broadcast over realtime.

## State machine

```
 DRAFT ──send──▶ SENT ──receive──▶ RECEIVED ──prepare──▶ PREPARING ──ready──▶ READY
   │              │                  │                     │                   │
   │              │                  │                     │                   ▼
   │              │                  │                     │             DELIVERED
   │              │                  │                     │                   │
   │              │                  │                     │                   ▼
   │              │                  │                     │              COMPLETED   (terminal)
   ▼              ▼                  ▼                     ▼
CANCELLABLE at any point before DELIVERED  ──────────────────────────▶  CANCELLED  (terminal)
```

- **Forward path**: `DRAFT → SENT → RECEIVED → PREPARING → READY → DELIVERED → COMPLETED`
- **Cancellation**: allowed from `DRAFT`, `SENT`, `RECEIVED`, `PREPARING`, `READY` (requires `orders.cancel`). `DELIVERED` can only be completed; `COMPLETED` and `CANCELLED` are terminal (no outgoing transitions).
- Statuses are stored as plain strings on `Order.status`; Spanish/English labels live in `ORDER_STATUS_LABELS_ES/EN`.

## Transition permission matrix

`TRANSITION_PERMISSIONS` maps each edge to the permission required. An unauthorized caller gets `403 {"error":"Sin permiso para esta acción (…)"}`.

| Transition | Required permission | Typical role |
|---|---|---|
| `DRAFT → SENT` | `orders.send` | Waiter, Supervisor, Manager, Admin |
| `SENT → RECEIVED` | `orders.prepare` | Kitchen Staff, Admin |
| `RECEIVED → PREPARING` | `orders.prepare` | Kitchen Staff, Admin |
| `PREPARING → READY` | `orders.ready` | Kitchen Staff, Manager, Admin |
| `READY → DELIVERED` | `orders.deliver` | Waiter, Supervisor, Manager, Admin |
| `DELIVERED → COMPLETED` | `orders.complete` | Cashier, Manager, Admin |
| `DRAFT → CANCELLED` | `orders.cancel` | Manager, Admin |
| `SENT → CANCELLED` | `orders.cancel` | Manager, Admin |
| `RECEIVED → CANCELLED` | `orders.cancel` | Manager, Admin |
| `PREPARING → CANCELLED` | `orders.cancel` | Manager, Admin |
| `READY → CANCELLED` | `orders.cancel` | Manager, Admin |

Full role/permission matrix: [roles-and-permissions.md](roles-and-permissions.md).

## Side effects

| Event | Notification(s) created | Realtime events | Other writes |
|---|---|---|---|
| `POST /api/orders` (`send: false`) | — | — | History `→ DRAFT`; audit `ORDER_CREATE` |
| `POST /api/orders` (`send: true`) | `NEW_ORDER` → **every active Kitchen Staff user** ("Nueva orden recibida") | `order.created`, `notification.created` (per kitchen user) | History `DRAFT→SENT`; table → `OCCUPIED` |
| transition → `RECEIVED` / `PREPARING` | — | `order.updated` | `assignedToId` = caller (if unassigned); history; audit `ORDER_<TO>` |
| transition → `READY` | `ORDER_READY` → **assignee (or creator)** ("Orden lista") | `order.updated`, `order.ready`, `notification.created` | History; audit |
| transition → `DELIVERED` | — | `order.updated`, `order.delivered` | History; audit |
| transition → `COMPLETED` \| `CANCELLED` | — | `order.updated` | Table → `NEEDS_CLEANING`; history; audit |
| every transition | — | `order.updated` always | `OrderStatusHistory` row (`fromStatus → toStatus`, optional note); `AuditLog` `ORDER_<TO>` with details `"from->to"` |

Realtime delivery: events are broadcast to all connected clients as `servehub:event`; `notification.created` is additionally emitted to the target user's room (`servehub:notify`, room `user:<id>`) — see [architecture.md](architecture.md). The UI reacts with toasts (waiter hears "Orden lista") and auto-refreshing views (dashboard kanban, orders board).

## API examples

### Create + send an order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "tableId": "cmtable01",
    "items": [
      { "name": "Ramen de Pollo", "quantity": 2, "price": 8.5, "notes": "sin cebolla" },
      { "name": "Coca-Cola", "quantity": 1, "price": 2.0 }
    ],
    "notes": "Cliente con prisa",
    "send": true
  }'
```

`201` → order in `SENT`, number `max+1` (base 1040), `total = 19.0` computed server-side, kitchen notified. Omit `"send": true` to keep the order in `DRAFT` (saved but not sent).

### Advance the workflow

```bash
# Kitchen marks it ready
curl -X POST http://localhost:3000/api/orders/cmorder01/transition \
  -H "Authorization: Bearer $KITCHEN_TOKEN" -H "Content-Type: application/json" \
  -d '{ "to": "READY", "note": "Platos emplatados" }'
```

```json
// 200
{ "order": { "id": "cmorder01", "number": 1041, "status": "READY", "…": "…" } }
// 400 wrong edge
{ "error": "Transición inválida: SENT → READY. Válidas: RECEIVED, CANCELLED" }
// 403 lacking permission
{ "error": "Sin permiso para esta acción (orders.deliver)" }
```

### Cancelling

```bash
curl -X POST http://localhost:3000/api/orders/cmorder01/transition \
  -H "Authorization: Bearer $MANAGER_TOKEN" -H "Content-Type: application/json" \
  -d '{ "to": "CANCELLED", "note": "Cliente se fue" }'
```

The table is released to `NEEDS_CLEANING` (kitchen/front cleans up before it becomes `AVAILABLE` again via the Tables view).

## Related

- Item-level status (`OrderItem.status`: `PENDING | PREPARING | READY | SERVED`) exists in the schema but is not advanced by the MVP endpoints.
- Table statuses and the tables API: [api.md](api.md) · Data model: [database.md](database.md)
