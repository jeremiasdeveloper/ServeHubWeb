# ServeHub — Localization (i18n)

ServeHub ships with **Spanish (`es`) as the default locale** and **English (`en`) as a secondary**. All UI strings live in one typed dictionary: `src/lib/i18n.ts` (612 lines, **278 keys per locale**, ~556 entries total). Spanish is also the fallback language at runtime.

## How it works

```
src/lib/i18n.ts        export const translations = { es: {…}, en: {…} }
                       export type Locale = "es" | "en"
                       export type TranslationKey = keyof typeof translations.es

src/lib/store.ts       locale state in the Zustand store
                       t(key, vars?) → dictionary lookup + {var} interpolation
                       setLocale() persists to localStorage "servehub_locale"
                       on boot, saved locale is restored from localStorage

components             const t = useApp(s => s.t);  t("nav.orders")  →  "Órdenes"
```

- **Lookup order** in `t()`: current locale → Spanish → the key itself (so a missing translation degrades visibly instead of crashing).
- **Interpolation**: `t("dashboard.welcome", { name: user.displayName })` replaces `{name}` placeholders via `interpolate()` in `src/lib/store.ts`.
- **Persistence**: `localStorage["servehub_locale"]`; the key is validated against `"es" | "en"` on load.
- The language can be switched from the **Settings** view; the config field `localization.defaultLanguage` defines the initial locale when nothing is saved ([configuration.md](configuration.md)).

## Key naming conventions

Keys are flat strings with a `section.camelCaseKey` structure:

| Prefix | Purpose | Examples |
|---|---|---|
| `app.*` | App-level strings | `app.name`, `app.tagline` |
| `splash.*` | Splash screen | `splash.loading`, `splash.connecting` |
| `login.*` | Login form | `login.title`, `login.demoDesc` |
| `admin.*` | Admin warning gate | `admin.warning`, `admin.countdown` |
| `nav.*` | Navigation items | `nav.dashboard`, `nav.customerService` |
| `common.*` | Shared UI vocabulary | `common.save`, `common.logout`, `common.retry` |
| `dashboard.*` | Dashboard view | `dashboard.activeOrders` |
| `orders.*`, `tables.*`, `employees.*`, `roles.*`, `complaints.*`, `customerService.*`, `chat.*`, `attendance.*`, `notifications.*`, `settings.*` | One section per view | `orders.newOrder`, `chat.placeholder` |
| `dev.*` | Developer panel | `dev.title`, `dev.mobilePreview` |
| `footer.*` | Shell footer | `footer.poweredBy`, `footer.version` |
| `*.type.*` | Enum label maps (statuses) | `notifications.type.ORDER_READY` |

Rules of thumb:

1. One key per user-visible string; never concatenate translated fragments.
2. Reuse `common.*` for repeated verbs/labels before adding a new view-local key.
3. Placeholders use `{snakeOrCamelCase}` — e.g. `"admin.countdown": "Continuando en {seconds}s..."`.
4. Both dictionaries must contain exactly the same key set; `TranslationKey` (derived from `es`) makes TypeScript flag any usage of a missing key.

Examples from the dictionary:

```ts
"login.demoDesc": "Contraseña para todos: 0000",        // es
"login.demoDesc": "Password for all: 0000",              // en

"dashboard.welcome": "Hola, {name}",                     // es — interpolate({name})
"dashboard.welcome": "Hello, {name}",                    // en

"admin.warning": "Cuidado con lo que haces",             // admin login gate
"admin.warning": "Be careful what you do",               // en
```

Statuses and other backend enums are translated through dedicated label maps in `src/lib/order-state.ts` (`ORDER_STATUS_LABELS_ES` / `ORDER_STATUS_LABELS_EN`, `TABLE_STATUS_LABELS_ES`) and through `*.type.*` i18n keys for notification types.

## Adding a language

Example: add Portuguese (`pt`).

1. **`src/lib/i18n.ts`**
   - Extend the type: `export type Locale = "es" | "en" | "pt"`.
   - Add a `pt: { … }` object to `translations` containing **all 278 keys** (copy `en` and translate; TypeScript will complain until the key set is complete because `TranslationKey` is derived from `es` only — keep `es` as the source of truth).
2. **`src/lib/config.ts`** — add `"pt"` to `DEFAULT_CONFIG.localization.supportedLanguages` (this drives the language picker in Settings).
3. **`src/lib/store.ts`**
   - Accept the new value in `setLocale` / the localStorage validation check (`if (saved === "es" || saved === "en" || saved === "pt")`).
   - `t()` already falls back to Spanish automatically for any key missing in `pt`.
4. Optional: add `ORDER_STATUS_LABELS_PT` in `src/lib/order-state.ts` and wire it where statuses are rendered.
5. Restart the dev server and switch languages in **Settings** to verify.

## Notes & gotchas

- Locale is a **client-side** concern; the API returns Spanish messages by design (e.g. `"Credenciales inválidas"`) and is not localized in the MVP.
- The document title is set from config (`${restaurant.name} · ServeHub`) by the branding injector, not from i18n.
- When adding a new view, add its keys to **both** dictionaries in the same commit to keep the key sets aligned.
