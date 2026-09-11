# ServeHub 1.0 — Notifications

Notifications are actionable: every notification routes to the relevant
application destination when clicked. They are never static text.

## Types

| Type | Trigger | Click target |
|------|---------|--------------|
| `NEW_ORDER` | Order sent to kitchen | Orders view |
| `ORDER_READY` | Kitchen marks order ready | Orders (specific order) |
| `NEW_MESSAGE` | Chat message received | Chat conversation |
| `COMPLAINT_ASSIGNED` | Complaint assigned | Complaint detail |
| `SYSTEM` | Administrative events | Depends on payload |

Routing context (order id, conversation id, complaint id) is stored in the
notification's `data` JSON column and used for deep navigation.

## Delivery

1. Server creates the `Notification` row for the target user.
2. The realtime service emits `servehub:notify` to the `user:<id>` socket room.
3. The client shows a toast and increments the unread badge (sidebar,
   header bell, bottom nav). Polling every 15 s backs up realtime.

## API

| Endpoint | Permission | Action |
|----------|------------|--------|
| `GET /api/notifications` | `notifications.view` | List (optional `?unread=1`) |
| `PATCH /api/notifications` | `notifications.view` | Mark all read |
| `PATCH /api/notifications/:id` | `notifications.view` | Mark one read |

## Clean state

A fresh installation has zero notifications. Demo notifications are only
created by explicit developer-mode reseeding.