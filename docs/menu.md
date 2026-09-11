# ServeHub 1.0 — Menu

The menu module manages restaurant categories and products. It is menu
management, not inventory/stock (no ERP).

## Model

- **MenuCategory** — `name` (unique), `sortOrder`, `active`.
- **MenuItem** — `name` (unique), `categoryId`, `description`, `price`,
  `available` (day-to-day availability), `active` (soft disable), `sortOrder`.

## API

| Endpoint | Permission | Action |
|----------|------------|--------|
| `GET /api/menu` | `menu.view` | Full menu (active categories with items) |
| `POST /api/menu/categories` | `menu.create` | Create category |
| `PATCH /api/menu/categories/:id` | `menu.edit` | Rename / reorder / deactivate |
| `POST /api/menu/items` | `menu.create` | Create product |
| `PATCH /api/menu/items/:id` | `menu.edit` / `menu.disable` | Edit, toggle availability, disable |

All mutations are audit-logged.

## UI

The Menu view lists categories as cards with their products, price and
availability badge. Administrators create/rename categories, add products,
change prices, mark products unavailable (still visible but not sellable)
or disable them entirely.

## Order integration

The create-order dialog loads the menu and lets waiters pick products
(name and price are filled automatically) instead of typing free text.
Manual entry remains available as a fallback.