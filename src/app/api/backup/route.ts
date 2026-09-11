// GET  /api/backup — download the SQLite database file (backup.create).
// POST /api/backup/restore — stage an uploaded backup; it replaces the live
// database on the next server start (backup.restore permission required).
import { db } from "@/lib/db"
import { resolveUser } from "@/lib/api"
import { hasPermission } from "@/lib/authz"
import { resolveDbFile, RESTORE_SUFFIX } from "@/lib/db-file"
import fs from "fs"

const SQLITE_MAGIC = "SQLite format 3\x00"

export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "backup.create")) return Response.json({ error: "No autorizado" }, { status: 403 })

  const dbFile = resolveDbFile()
  if (!dbFile || !fs.existsSync(dbFile)) {
    return Response.json({ error: "No se encontró el archivo de base de datos" }, { status: 500 })
  }
  try {
    // Flush WAL data into the main file so the backup is complete.
    await db.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)")
  } catch {}
  const data = fs.readFileSync(dbFile)
  const name = `servehub-backup-${new Date().toISOString().slice(0, 10)}.db`
  await db.auditLog.create({
    data: { userId: user.id, action: "BACKUP_CREATE", entity: "Database", entityId: name },
  })
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  })
}

export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!hasPermission(user, "backup.restore")) return Response.json({ error: "No autorizado" }, { status: 403 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Se esperaba un formulario multipart" }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) return Response.json({ error: "Archivo de respaldo requerido" }, { status: 400 })
  if (file.size > 512 * 1024 * 1024) return Response.json({ error: "Archivo demasiado grande" }, { status: 400 })

  const head = Buffer.from(await file.slice(0, 16).arrayBuffer())
  if (!head.toString("latin1").startsWith(SQLITE_MAGIC)) {
    return Response.json({ error: "El archivo no es una base de datos SQLite válida" }, { status: 400 })
  }

  const dbFile = resolveDbFile()
  if (!dbFile) return Response.json({ error: "No se pudo resolver la base de datos" }, { status: 500 })

  // The live database is open, so the restore is staged and applied on the
  // next server start (see bootstrap.ts applyPendingRestore).
  fs.writeFileSync(dbFile + RESTORE_SUFFIX, Buffer.from(await file.arrayBuffer()))

  await db.auditLog.create({
    data: { userId: user.id, action: "BACKUP_RESTORE", entity: "Database", entityId: "staged" },
  })
  return Response.json({ ok: true, note: "La restauración se aplicará al reiniciar la aplicación ServeHub" })
}
