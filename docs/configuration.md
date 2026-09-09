# ServeHub — Configuration

ServeHub is configured at runtime by a single JSON document defined in `src/lib/config.ts` (`DEFAULT_CONFIG`, type `ServeHubConfig`) and served publicly by `GET /api/config`. The frontend fetches it once at boot; feature flags decide which navigation modules exist, and branding colors are injected as CSS variables by `src/components/branding-injector.tsx`.

The demo configuration ships for the fictional restaurant **Café Sakura** (`cafe_sakura`).

## Full config example

```json
{
  "restaurant": {
    "name": "Café Sakura",
    "id": "cafe_sakura",
    "logo": null,
    "tagline": "Operaciones de restaurante en tiempo real"
  },
  "branding": {
    "primaryColor": "#E85D75",
    "secondaryColor": "#FFFFFF",
    "accentColor": "#FFB7C5"
  },
  "features": {
    "orders": true,
    "employees": true,
    "complaints": true,
    "customerService": true,
    "chat": true,
    "attendance": true,
    "tables": true,
    "notifications": true
  },
  "localization": {
    "defaultLanguage": "es",
    "supportedLanguages": ["es", "en"]
  },
  "server": {
    "realtimePort": 3003,
    "version": "1.0.0-mvp"
  }
}
```

> `GET /api/config` additionally returns `"counts": { "users": 6, "tables": 12, "orders": 5 }` (database row counts used by the splash screen). This field is added by the endpoint and is not part of `DEFAULT_CONFIG`.

## Field reference

| Path | Type | Description |
|---|---|---|
| `restaurant.name` | `string` | Display name used in the shell header, login screen and document title (`<name> · ServeHub`). |
| `restaurant.id` | `string` | Stable restaurant identifier / code (e.g. `cafe_sakura`). Also seeded into `RestaurantSetting` as `restaurant_id`. |
| `restaurant.logo` | `string \| null` | Logo URL. `null` falls back to a letter avatar (first letter of the name on the brand gradient). |
| `restaurant.tagline` | `string?` | Subtitle shown on splash/login. |
| `branding.primaryColor` | hex string | Main brand color. Injected as `--brand` and overrides `--primary`, `--ring`, `--sidebar-primary` so all shadcn/ui components follow it. |
| `branding.secondaryColor` | hex string | Foreground color on brand-colored surfaces (`--brand-foreground`). |
| `branding.accentColor` | hex string | Gradient companion (`--brand-accent`) used on avatars, splash and login background. |
| `features.orders` | `boolean` | Shows/hides the **Orders** nav item (also gated by `orders.view`). |
| `features.employees` | `boolean` | **Employees** module. |
| `features.complaints` | `boolean` | **Complaints** module. |
| `features.customerService` | `boolean` | **Customer service** module. |
| `features.chat` | `boolean` | **Chat** module. |
| `features.attendance` | `boolean` | **Attendance** module. |
| `features.tables` | `boolean` | **Tables** module. |
| `features.notifications` | `boolean` | **Notifications** module. |
| `localization.defaultLanguage` | `"es" \| "en"` | Locale used when the visitor has no saved preference. |
| `localization.supportedLanguages` | `("es" \| "en")[]` | Languages offered in settings. |
| `server.realtimePort` | `number` | Port of the socket.io mini-service (client connects `io("/?XTransformPort=3003")`). |
| `server.version` | `string` | Displayed in the desktop footer (`footer.version`). |

### Feature flag behavior

- Flags are evaluated in `src/components/responsive-shell.tsx` (`useNavItems`): a nav item is rendered only if the user holds the matching permission **and** the feature flag is enabled. Flags cannot grant access — they only hide modules; the API still enforces permissions server-side.
- Views remain reachable only through the nav, so a disabled module is effectively invisible. The dashboard adapts its metric cards to the enabled features.
- Flags are currently served statically (`getConfig()` returns `DEFAULT_CONFIG`). A `RestaurantSetting` row with key `servehub_config` is the intended future override hook (noted in `src/lib/config.ts`), but it is **not** wired up in the MVP.

## Adapting ServeHub for another restaurant

1. Edit `DEFAULT_CONFIG` in `src/lib/config.ts` (or load the JSON from `RestaurantSetting` key `servehub_config` if you wire the override):
   - `restaurant.name` / `id` / `tagline` / `logo`.
   - `branding.*` colors — they flow through CSS variables, no component changes needed.
   - Disable modules you don't need with `features` (e.g. set `customerService: false`).
2. Reset the demo data: `bun run db:push` (fresh schema) then edit and run `scripts/seed.ts` with your own users/tables. See [development.md](development.md).
3. Optionally update the `restaurant_name` / `restaurant_id` rows in the `RestaurantSetting` table via `PATCH /api/settings`.
4. Restart the server — config is read server-side by `/api/config` on each request, so a restart (or a dynamic `getConfig`) is enough.

## Related settings

- Key/value restaurant settings live in the `RestaurantSetting` table (`GET/PATCH /api/settings`, permission `settings.view` / `settings.edit`). The seed creates `restaurant_name` and `restaurant_id`.
- Localization defaults are covered in [localization.md](localization.md); the config only sets the default + supported languages, while the user's choice is persisted in `localStorage` (`servehub_locale`).
