# ServeHub 1.0 — Android Application

## Overview

The Android app is a thin client for employees. It connects to the
restaurant's ServeHub server over the local network.

- **No self-registration** — accounts are created by the administrator.
- **LAN-first** — no Internet required for normal operations.
- **Offline read-only** — synchronized data remains viewable when disconnected.

## Connection Flow

```text
Splash → Connect to Restaurant → Login → Employee Dashboard
```

### Automatic Discovery

The app searches for `_servehub._tcp` services via mDNS. Discovered
servers show the restaurant name and Server ID.

### Manual Connection

If discovery finds no servers, enter the server IP and port manually:

```text
Server address: 192.168.1.20
Port: 3000
```

## Session Binding

The Android session is tied to the restaurant it authenticated against.
Switching restaurants requires explicit reconnection.

## Offline Mode

When the server becomes unreachable:

- A banner indicates offline/read-only status.
- All write operations (create order, send message, etc.) are blocked.
- Previously loaded data remains viewable.
- The app periodically pings the server and reconnects automatically.

## Requirements

- Android 7.0+ (API 24)
- arm64-v8a architecture (the release APK targets this ABI)
- Wi-Fi connection to the restaurant's LAN
