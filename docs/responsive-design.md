# ServeHub — Responsive Design

ServeHub is a mobile-first web app: the same single `/` route renders a desktop layout (sidebar) and a mobile layout (top header + bottom navigation) using Tailwind CSS breakpoints. No separate mobile build exists — the layout adapts at runtime, and a built-in preview frame simulates a phone.

## Breakpoints

Standard Tailwind defaults are used (no custom `screens` in `tailwind.config.ts`):

| Tier | Width | Layout |
|---|---|---|
| **Mobile** | `< 768px` (`md` and below) | Sticky top header (h-14) + fixed bottom nav (5 items) + full-nav drawer; content full width, `pb-20` to clear the bottom bar |
| **Tablet** | `768px – 1023px` (`md`, below `lg`) | Same mobile chrome as phones; content grids gain columns (e.g. dashboard cards `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`) |
| **Desktop** | `≥ 1024px` (`lg` and up) | Fixed left sidebar (w-64) + top header offset by `lg:pl-[17rem]`; footer visible; bottom nav hidden |

Additionally `src/hooks/use-mobile.ts` exposes `useIsMobile()` (JS media query at 768px) for logic that must branch on device class rather than CSS.

## Sidebar (desktop, `lg+`)

Implemented in `src/components/responsive-shell.tsx`:

- Fixed `aside` (w-64) with restaurant identity (brand gradient letter avatar + name), scrollable nav, user card (avatar initials + display name + role) and logout at the bottom.
- Nav items are filtered by **permission** (`usePermissions().can`) and **feature flag** (`config.features`), see [roles-and-permissions.md](roles-and-permissions.md) and [configuration.md](configuration.md).
- The notifications item shows a live unread badge (polls `GET /api/notifications?unread=1` every 15 s).
- Main content is padded `lg:pl-64` and centered at `max-w-7xl`; a desktop-only footer shows "Powered by ServeHub" + `config.server.version`.

## Mobile chrome (`< lg`)

- **Top header**: hamburger button opening a `Sheet` drawer (side="left", w-72) that reuses the *same* sidebar content, restaurant name, realtime Wi-Fi indicator (connected/disconnected), and a bell with unread badge.
- **Bottom navigation**: fixed, `safe-area-inset-bottom`, `grid-cols-5`. It shows a prioritized subset of nav items — priority order: `dashboard`, `orders`, `chat`, `attendance`, `notifications` — and backfills from the remaining permission/feature-filtered items if some priorities are unavailable. Active item is highlighted with a small underline bar.
- Content bottom padding (`pb-20`) prevents overlap with the bar; headers use `backdrop-blur` over scrolling content.

## Realtime status indicator

Both layouts show a Wi-Fi icon wired to `useApp(s => s.realtimeConnected)` (green = socket connected, amber = offline), fed by the singleton socket manager in `src/lib/use-realtime.ts` ([architecture.md](architecture.md)).

## Mobile preview (developer mode)

`src/components/views/mobile-preview-frame.tsx` wraps the active view in a 390 × 844 phone frame (rounded bezel, notch, max-height 80vh with inner scroll) whenever **mobile preview** is enabled from the developer panel (F10 → *Vista previa móvil*, permission `developer.access`). It lets desktop users verify the mobile chrome behavior without a device. Note: the frame constrains the *content area*; the surrounding desktop shell stays as-is.

## Testing responsive behavior

1. **DevTools device toolbar** (recommended): Chrome DevTools → Toggle device toolbar → presets like iPhone 14 Pro (393×852) or Pixel 7 (412×915). Below 1024px you should see the header + bottom nav; at ≥1024px the sidebar.
2. **Browser resize**: drag the window across 768px and 1024px; the layout switches instantly with no reload (CSS-only breakpoint).
3. **Developer panel preview**: log in as `admin` → press **F10** → enable *Vista previa móvil*.
4. **Real device**: serve on the LAN (`bun run dev` or the production build, see [deployment.md](deployment.md)) and open `http://<pc-ip>:81` on a phone — this is the same path the future Tauri Android shell will use ([tauri.md](tauri.md)).

Checklist per tier: bottom-nav taps switch views without page reloads · unread badge appears in header, drawer and bottom nav · tables/orders kanban reflow into single column · dialogs/sheets fit the viewport · no horizontal scroll.

## Related

- View components: [architecture.md](architecture.md) (module map) · Feature flags that trim the nav: [configuration.md](configuration.md)
