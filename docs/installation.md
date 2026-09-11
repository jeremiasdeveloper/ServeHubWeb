# ServeHub 1.0 — Installation

## Windows

### Installer (Recommended)

1. Download `ServeHub_1.0.0_x64-setup.exe` from the release.
2. Run the installer and follow the prompts.
3. Launch ServeHub from the Start Menu or desktop shortcut.

### Portable

Run `servehub.exe` directly. The server resources must be in a `server/`
subdirectory relative to the executable.

## Android

1. Download `ServeHub.apk` from the release.
2. Transfer to your Android device.
3. Enable "Install from unknown sources" if prompted.
4. Install and open the app.

## First-Run Setup

On first launch (when no users exist), the Setup Wizard appears:

1. **Restaurant** — name, ID slug, tagline.
2. **Branding** — primary, secondary, accent colors; font; language.
3. **Administrator** — username and password for the first admin account.

The Server ID is generated automatically and persisted.

## Development

```bash
bun install
bunx prisma db push
bun run dev
```

The dev server runs at http://localhost:3000.
