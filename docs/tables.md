# ServeHub 1.0 — Tables

Tables are configurable restaurant seats tracked as a simple grid — no
floor-plan editor.

## Model

- **Table** — `number` (unique, e.g. "01"), `capacity`, `location`
  (free-text zone like "Salón principal"), `status`.

## Statuses

| Status | Spanish label | Meaning |
|--------|---------------|---------|
| `AVAILABLE` | Disponible | Free to seat |
| `OCCUPIED` | Ocupada | Seated / has an active order (set automatically when an order is sent) |
| `RESERVED` | Reservada | Booked |
| `NEEDS_CLEANING` | Necesita limpieza | Needs attention before seating |

## API

| Endpoint | Permission | Action |
|----------|------------|--------|
| `GET /api/tables` | `tables.view` | List tables with status and open orders |
| `POST /api/tables` | `tables.edit` | Create table |
| `PATCH /api/tables/:id` | `tables.edit` | Change status / capacity / location |
| `DELETE /api/tables/:id` | `tables.edit` | Delete table |

## Order integration

When an order is sent, its table flips to `OCCUPIED`. The orders view
shows the table number on every order card; creating an order requires
selecting a table.