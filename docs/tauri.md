# ServeHub — Tauri 2 Desktop & Android (Roadmap)

The original ServeHub specification targets **Tauri 2** packaging for **Windows (.exe)** and **Android (.apk)**, running against a server on the restaurant's PC. The current implementation is a **web-first MVP**: it runs in any browser on the LAN and needs no installation on client devices ([architecture.md](architecture.md)).

> **Status (honest):** the Tauri 2 packaging path below is fully documented and ready to execute, but **no Tauri binaries were produced in this sandbox** — no Rust toolchain, Android SDK/NDK or Windows environment is available here. The steps have not been compiled or smoke-tested end-to-end.

## Target topology

```
┌────────────────────────── Restaurant PC ──────────────────────────┐
│  ServeHub web stack (see deployment.md)                           │
│  Next.js :3000 · realtime :3003 · Caddy :81  ← single LAN URL     │
└───────────────┬───────────────────────────────────────────────────┘
                │ http://<pc-ip>:81  (REST + socket.io)
     ┌──────────┴───────────┬──────────────────────┐
     ▼                      ▼                      ▼
 Browsers (any)     Tauri 2 Windows shell   Tauri 2 Android app
 (zero-install)     ServeHub.exe            ServeHub.apk
                    (thin client window)    (thin client webview)
```

The Tauri shells are **thin clients**: the system webview loads the restaurant PC's LAN URL. All business logic, the database and realtime stay server-side — exactly what browsers already consume.

## Strategy A — remote-URL thin client (recommended)

The window/webview points at `http://<pc-ip>:81`. Simplest, smallest APK/EXE, and updates happen only on the server.

### 1. Install the tooling (on a machine with Rust installed)

```bash
# Rust 1.77+ (https://rustup.rs) — required once
bun add -D @tauri-apps/cli          # or: npm i -D @tauri-apps/cli
bun tauri init
```

`bun tauri init` prompts — use:

| Prompt | Value |
|---|---|
| Application name | `ServeHub` |
| Window title | `ServeHub` |
| Dev server URL | `http://localhost:3000` |
| Production dist | leave as-is; we override to a remote URL below |
| Frontend dev command | `bun run dev` |
| Frontend build command | `bun run build` |

### 2. Point the window at the LAN server

Tauri 2 allows any URL in `app.windows[].url`. In `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ServeHub",
  "identifier": "com.servehub.app",
  "build": {
    "devUrl": "http://localhost:3000",
    "frontendDist": "http://192.168.1.50:81"
  },
  "app": {
    "windows": [
      {
        "title": "ServeHub",
        "width": 1280,
        "height": 860,
        "resizable": true,
        "url": "http://192.168.1.50:81"
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

Replace `192.168.1.50` with the restaurant PC's static LAN IP (reserve it via DHCP). With `"csp": null` the webview allows the mixed content (websockets, fonts) the app needs on a trusted LAN.

### 3. Build

```bash
bun tauri build                    # Windows: .exe + NSIS installer in src-tauri/target/release/bundle/
bun tauri build --bundles nsis     # installer-only, if preferred
```

Distribute the installer to the restaurant's terminals; the app opens ServeHub in a kiosk-like window on login.

## Strategy B — Rust core as API companion (advanced)

If you later want native capabilities (printing, barcode scanners, offline queue), move them into Tauri commands that call the **same REST API** — the frontend keeps using `src/lib/api-client.ts`, optionally proxied through the core:

```rust
// src-tauri/src/lib.rs (sketch)
use serde_json::Value;

#[tauri::command]
async fn api_proxy(token: String, path: String, body: Value) -> Result<Value, String> {
    let url = format!("http://192.168.1.50:81{}", path);
    let client = reqwest::Client::new();
    let res = client.post(url)
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    res.json().await.map_err(|e| e.to_string())
}
```

```ts
// frontend
import { invoke } from "@tauri-apps/api/core"
const order = await invoke("api_proxy", { token, path: "/api/orders", body: payload })
```

This keeps one server implementation (Next.js REST, [api.md](api.md)) and adds native device features without forking business logic. Not required for the MVP.

## Android (.apk) — Strategy A on mobile

```bash
# Prerequisites (host machine): Android Studio, SDK, NDK, and env vars
#   ANDROID_HOME, NDK_HOME; Rust targets:
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

bun tauri android init
bun tauri android build --apk          # debug/signable APK
# release (signed): configure signing in src-tauri/gen/android, then
bun tauri android build --apk --release
```

Output: `src-tauri/gen/android/app/build/outputs/apk/…/app-*.apk`. Install on staff phones; the app loads `http://<pc-ip>:81` in the system webview.

**Android cleartext HTTP:** Android 9+ blocks plain `http://` by default. For a LAN-only deployment either (a) rely on Tauri's generated manifest and add `android:usesCleartextTraffic="true"` to the `<application>` tag in `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, or (b) put a TLS certificate on the Caddy gateway (recommended when available — then no cleartext exception is needed). Also ensure the Tauri config permits remote URLs (Strategy A does, since the window URL *is* remote).

## Why not bundle the Next.js server inside Tauri?

Tauri apps ship a static frontend plus a Rust core; they do not run a Node process. Bundling the Next.js standalone server as a Tauri **sidecar** binary is possible but pointless here: the server must be single-instance anyway (shared SQLite + realtime), which is exactly the restaurant-PC topology in [deployment.md](deployment.md). Thin clients keep one source of truth.

## Checklist when you do have a toolchain

1. `bun add -D @tauri-apps/cli && bun tauri init` (Strategy A values above).
2. Replace `frontendDist`/window `url` with the LAN URL; set `"csp": null`.
3. `bun tauri build` → verify the Windows shell boots to the splash → login (`admin/0000` demo) → realtime indicator turns green.
4. `bun tauri android init && bun tauri android build --apk` → install on a phone, repeat the smoke test, confirm bottom-nav layout ([responsive-design.md](responsive-design.md)).
5. Decide cleartext vs TLS; if TLS, point shells at `https://…`.
6. Version the `src-tauri/` folder in git; do **not** commit `src-tauri/target/` or `gen/android` build outputs.
