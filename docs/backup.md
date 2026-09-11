# ServeHub 1.0 — Backup & Restore

## Create Backup

**Permission**: `backup.create` (Administrator)

Navigate to Settings → Backup → "Descargar backup". The SQLite database
file is downloaded as `servehub-backup-<date>.db`.

## Restore Backup

**Permission**: `backup.restore` (Administrator)

1. Navigate to Settings → Backup → "Restaurar backup".
2. Select a `.db` file.
3. Confirm the operation.
4. The restore is staged and applied on the next application restart.

## Implementation

- Backup: streams the SQLite file from the server.
- Restore: uploads the file, validates the SQLite magic bytes, stages it
  as `<db>.restore-pending`. On next server start, `bootstrap.ts` swaps
  the staged file into place before Prisma opens the database.

## Notes

- Restore requires an application restart to take effect.
- The operation is audit-logged.
- No automatic scheduled backups in 1.0 (manual only).
