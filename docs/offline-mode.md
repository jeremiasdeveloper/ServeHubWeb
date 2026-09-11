# ServeHub 1.0 — Offline Mode

## Behavior

When the Android client (or any remote client) loses connection to the
ServeHub server:

1. A connectivity monitor detects the failure via `/api/health` pings.
2. The app enters **offline read-only mode**.
3. A banner is displayed: "Sin conexión con el servidor — Solo lectura".
4. All write operations are blocked at the API client layer.

## What Remains Available

- Previously loaded/viewed data (orders, tables, chat history, etc.)
- Navigation between views
- Reading notifications

## What Is Blocked

- Creating/editing orders
- Sending chat messages
- Creating complaints
- Modifying attendance
- Any server-side mutation

## Reconnection

The monitor pings the server every 8 seconds while offline. When the
server responds:

1. Offline mode is cleared.
2. The UI returns to full functionality.
3. Data is refreshed from the server.

## Session Validation

If the session expires while offline, the user is redirected to the login
screen upon reconnection. The app never silently authenticates with invalid
credentials.
