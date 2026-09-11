# ServeHub 1.0 — Developer Mode

## Activation

Press **F10** while logged in as a user with `developer.access` permission.

## Features

- **Configuration viewer** — full runtime config JSON
- **Restaurant settings** — name, branding, features
- **Server status** — API health, database status, realtime status
- **Permission diagnostics** — resolved permissions for current user
- **Table counts** — record counts per database table
- **Demo data** — reseed development/test data (requires explicit action)
- **Mobile preview** — 9:16 viewport simulation
- **Config reload** — refresh configuration from server

## Important

Developer Mode is NOT Administrator Mode. It provides diagnostic and
development tooling. It does not bypass permissions.

## Demo Data

The "Reseed database" action in Developer Mode creates clearly marked
development/test data (users with password `0000`). This data:

- Is only created through explicit developer action
- Never runs automatically in production
- Should not be used for real restaurant operations
