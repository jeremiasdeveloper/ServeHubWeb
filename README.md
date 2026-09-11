# ServeHub

**Plataforma de operaciones para restaurantes — Windows, Android y Web.**

ServeHub es un sistema de gestión de restaurantes auto-alojado que funciona en el hardware del propio restaurante. El PC con Windows actúa como servidor autorizado; los dispositivos Android se conectan como clientes de empleado a través de la red local. **No se necesita Internet para operar.**

> **ServeHub 1.0** — instalador NSIS para Windows (`ServeHub_1.0.0_x64-setup.exe`) y APK Android firmado (`ServeHub.apk`) disponibles en [Releases](../../releases).

---

## Arquitectura

```text
                 Wi-Fi / LAN del restaurante
                          │
             ┌────────────┴────────────┐
             │                         │
       ServeHub Server              Android
        (PC Windows)              (Empleados)
     Next.js :3000                 APK Tauri 2
     socket.io :3003               descubrimiento mDNS
             │                         │
             └─────── SQLite ──────────┘
```

- **Windows**: servidor del restaurante + administración (Tauri 2 + Next.js standalone + Bun).
- **Android**: cliente ligero de empleado (Tauri 2). Se conecta al servidor por LAN con descubrimiento automático mDNS (`_servehub._tcp`) y fallback manual IP:puerto.
- **Web**: el mismo frontend servido por el servidor Next.js.

## Módulos

| Módulo | Descripción |
|--------|-------------|
| Pedidos | Flujo completo: Borrador → Enviado → Recibido → Preparando → Listo → Entregado → Completado (máquina de estados validada en el servidor) |
| Mesas | Grilla configurable con estados (Disponible, Ocupada, Reservada, Necesita limpieza) |
| Menú | Categorías y productos con precio y disponibilidad |
| Empleados | Gestión de usuarios (crear, editar, desactivar, restablecer contraseña) |
| Roles | Roles modulares en español con permisos granulares editables |
| Chat | Mensajería de equipo en tiempo real (limpio en instalaciones nuevas) |
| Quejas | Seguimiento con estados Abierta → En progreso → Resuelta → Cerrada |
| Servicio al cliente | Solicitudes ligeras por canal |
| Asistencia | Check-in / Check-out por empleado y fecha |
| Notificaciones | Accionables: cada notificación navega a su destino |
| PDF | Comprobantes y resúmenes de pedidos con branding del restaurante |
| Backup | Descarga y restauración de la base SQLite |
| Auditoría | Registro de acciones administrativas |
| Modo desarrollador | Panel de diagnóstico con F10 |

## Instalación

### Windows

1. Descarga `ServeHub_1.0.0_x64-setup.exe` desde [Releases](../../releases) e instálalo.
2. Abre ServeHub. El servidor del restaurante arranca automáticamente (base de datos, API en el puerto 3000, tiempo real en el 3003).
3. En el primer arranque aparece el **asistente de configuración inicial**: nombre del restaurante, colores, fuente, idioma y creación de la cuenta administradora (con generador de contraseña).

No se requiere Node.js ni ninguna herramienta de desarrollo.

### Android

1. Instala `ServeHub.apk` en el dispositivo (Android 7.0+, arm64).
2. Abre la app: busca automáticamente servidores ServeHub en la red local (`_servehub._tcp`) y muestra nombre del restaurante + Server ID.
3. Toca **CONECTAR** e inicia sesión con una cuenta creada por el administrador.

No existe el registro de usuarios: los empleados solo acceden con cuentas creadas desde la administración.

### Identidad del servidor

Cada instalación genera un **Server ID estable** (p. ej. `SH-CF9A-8X21`) que persiste entre reinicios y se anuncia por mDNS para que los dispositivos Android identifiquen el restaurante correcto.

## Modo sin conexión (Android)

Si el dispositivo pierde la conexión con el servidor:

- La información previamente sincronizada sigue visible en **modo solo lectura**.
- Todas las operaciones de escritura (crear pedidos, enviar mensajes, quejas, asistencia…) se bloquean y la UI lo indica con claridad.
- Al volver la conexión, la sesión se revalida y los datos se refrescan automáticamente. No hay cola oculta de escrituras.

Internet y servidor ServeHub son cosas distintas: sin Internet pero con LAN, todo sigue funcionando.

## Seguridad

- Hashing de contraseñas con **Argon2id**; sin contraseñas en texto plano.
- Sesiones opacas con TTL de 12 horas; los usuarios desactivados no pueden entrar.
- **Todos** los permisos se validan en el servidor; el frontend nunca es fuente de autoridad.
- Auditoría de acciones administrativas (creación de empleados, cambios de rol, backups, configuración).

## Builds de producción

```bash
bun install
bunx prisma db push          # esquema → SQLite
bun run build                # standalone web/Windows
bun run start                # servidor de producción

# Paquete Windows (recursos del servidor + instalador NSIS)
bash packaging/build-windows-package.sh
bunx tauri build

# APK Android
SERVEHUB_EXPORT=1 bunx next build    # frontend estático (rutas API excluidas)
bunx tauri android init              # primera vez
bunx tauri android build             # luego firmar con apksigner
```

## Desarrollo

```bash
bun install
bunx prisma db push
bun run dev                  # http://localhost:3000
```

En desarrollo puedes cargar datos de prueba (marcados como DEVELOPMENT/TEST) desde `bun run scripts/seed.ts` o el Modo Desarrollador (F10). Una instalación de producción arranca limpia: solo roles del sistema y el Server ID; el primer administrador se crea en el asistente.

## Documentación

- [Arquitectura](docs/architecture.md) · [Instalación](docs/installation.md) · [Windows](docs/windows.md) · [Android](docs/android.md)
- [Servidor y LAN](docs/server.md) · [Autenticación](docs/authentication.md) · [Roles y permisos](docs/roles-and-permissions.md)
- [Pedidos](docs/orders.md) · [Menú](docs/menu.md) · [Mesas](docs/tables.md) · [Notificaciones](docs/notifications.md)
- [Modo offline](docs/offline-mode.md) · [PDF](docs/pdf.md) · [Backup](docs/backup.md) · [Configuración](docs/configuration.md)
- [Localización](docs/localization.md) · [Modo desarrollador](docs/developer-mode.md) · [Seguridad](docs/security.md) · [Despliegue](docs/deployment.md)

## Stack

Next.js 16 · React 19 · TypeScript · Prisma + SQLite · Socket.IO · Tauri 2 (Rust) · Bun · Tailwind CSS 4 · shadcn/ui

## Licencia

Ver [LICENSE](LICENSE).