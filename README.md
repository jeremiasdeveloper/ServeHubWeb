# ServeHub

**Plataforma web-first de operaciones para restaurantes** — configurable, multi-restaurante, responsive y en tiempo real.

ServeHub entrega a cada restaurante su propia versión de marca de la misma aplicación: administración, empleados, roles y permisos, mesas, órdenes con flujo de cocina, quejas, servicio al cliente, chat interno, asistencia, notificaciones y configuración — todo en un único frontend que se adapta automáticamente a escritorio y móvil.

> **Estado del MVP**: funcional en navegador (escritorio + móvil), con datos demo de **Café Sakura**. El empaquetado Tauri 2 (Windows/Android) está documentado como ruta oficial en [`docs/tauri.md`](docs/tauri.md).

---

## Índice

1. [Capturas](#capturas)
2. [Qué incluye el MVP](#qué-incluye-el-mvp)
3. [Arquitectura](#arquitectura)
4. [Web-first y multiplataforma](#web-first-y-multiplataforma)
5. [Diseño responsive automático](#diseño-responsive-automático)
6. [Órdenes y flujo de cocina](#órdenes-y-flujo-de-cocina)
7. [Empleados, roles y permisos](#empleados-roles-y-permisos)
8. [Tiempo real](#tiempo-real)
9. [Módulos de soporte](#módulos-de-soporte)
10. [Configuración JSON por restaurante](#configuración-json-por-restaurante)
11. [Localización (ES/EN)](#localización-esen)
12. [Pantalla de inicio (splash) y branding](#pantalla-de-inicio-splash-y-branding)
13. [Modo desarrollador (F10) y vista previa móvil](#modo-desarrollador-f10-y-vista-previa-móvil)
14. [Inicio rápido](#inicio-rápido)
15. [Credenciales demo](#credenciales-demo)
16. [Builds de producción](#builds-de-producción)
17. [Windows y Android (Tauri 2)](#windows-y-android-tauri-2)
18. [Redes: el PC del restaurante es el servidor](#redes-el-pc-del-restaurante-es-el-servidor)
19. [Documentación completa](#documentación-completa)
20. [Solución de problemas](#solución-de-problemas)
21. [Arquitectura futura en la nube](#arquitectura-futura-en-la-nube)
22. [Contribuir](#contribuir)
23. [Licencia](#licencia)

---

## Capturas

| Splash / Login | Dashboard (escritorio) |
| --- | --- |
| *(ejecuta el proyecto para verlo — splash con branding Café Sakura)* | *(sidebar + tarjetas de estado + órdenes recientes)* |

| Advertencia de administrador | Órdenes (kanban por estado) |
| --- | --- |
| *cuenta regresiva de 10s — "Cuidado con lo que haces"* | *(transiciones con permisos por rol)* |

> Los módulos se ven mejor en vivo: `bun run dev` y abre la app.

## Qué incluye el MVP

- **Autenticación** con usuario + contraseña por restaurante (Argon2id, sesiones de 12 h)
- **7 roles** del sistema y **31 permisos** aplicados en el backend (ocultar UI no es seguridad)
- **Órdenes** con máquina de estados validada en servidor: `DRAFT → SENT → RECEIVED → PREPARING → READY → DELIVERED → COMPLETED` (+ `CANCELLED`)
- **Mesas** con estados (`Disponible`, `Ocupada`, `Reservada`, `Necesita limpieza`) en grilla responsive
- **Tiempo real** (socket.io): la cocina marca "lista" y el mesero recibe la notificación al instante
- **Chat interno** con conversaciones grupales y mensajes en vivo
- **Quejas** y **servicio al cliente** con asignación y resolución
- **Asistencia** (check-in/check-out diario) y **notificaciones** por usuario
- **Configuración JSON** por restaurante: branding, features, idiomas
- **ES/EN** con español por defecto — ningún texto visible está hardcodeado
- **Modo desarrollador (F10)** con estado del servidor, conteos por tabla, recarga de configuración, re-seed de datos y **vista previa móvil 390×844**
- **Advertencia de administrador** con cuenta regresiva de 10 s al iniciar sesión como admin

## Arquitectura

```text
┌────────────────────────────────────────────────────────────┐
│                  ServeHub (un solo frontend)               │
│   Next.js 16 + React 19 + TypeScript + Tailwind + shadcn   │
│   layouts adaptativos: sidebar (≥1024px) / bottom-nav (<768)│
└──────────────┬─────────────────────────────┬───────────────┘
               │ REST (fetch, JSON)          │ WebSocket (socket.io)
               ▼                             ▼
┌──────────────────────────┐   ┌─────────────────────────────┐
│  API Routes (Next.js)    │   │  mini-services/realtime     │
│  /api/auth /api/orders   │   │  socket.io :3003 (clientes) │
│  /api/tables /api/chat … │──▶│  bridge HTTP :3004 (API →   │
│  auth · permisos · estado│   │  broadcast de eventos)      │
└──────────────┬───────────┘   └─────────────────────────────┘
               │ Prisma ORM (SQL parametrizado)
               ▼
┌──────────────────────────┐
│  SQLite  db/custom.db    │
│  16 modelos, FK + índices│
└──────────────────────────┘
```

> **Nota de adaptación**: la especificación original planteaba Vite + Axum/Rust + SQLx. Este MVP se implementó sobre **Next.js 16 (App Router) + Prisma/SQLite + socket.io**, que cubre exactamente los mismos requisitos funcionales (REST, auth, permisos, WebSocket, SQLite) en un solo repositorio ejecutable. La separación frontend/servicios se mantiene limpia (`src/lib/api-client.ts` es la única puerta del frontend hacia el backend), por lo que migrar la capa de API a Rust/Axum más adelante no requiere tocar la UI. Detalles en [`docs/architecture.md`](docs/architecture.md).

## Web-first y multiplataforma

- **Desarrollo**: `bun run dev` (o `npm run dev`) levanta todo lo necesario en el puerto **3000**.
- **Navegador**: la app completa funciona sin nada extra — escritorio o móvil.
- **Windows / Android**: el mismo frontend se empaqueta con **Tauri 2** (sin Electron). Ver [`docs/tauri.md`](docs/tauri.md).
- **Un solo código**: modelos, capa API, estado, lógica de negocio, rutas, i18n y configuración son compartidos; solo la presentación se adapta.

## Diseño responsive automático

No hay selector "modo escritorio / modo móvil": la app responde al viewport real.

| Rango | Layout |
| --- | --- |
| `< 768px` (móvil, 9:16) | Header compacto, **bottom navigation**, tarjetas apiladas |
| `768 – 1023px` (tablet) | Grillas intermedias |
| `≥ 1024px` (escritorio 16:9) | **Sidebar fijo** + header superior + contenido max-w-7xl |

- Orientación portrait/landscape manejada por media queries y `matchMedia`.
- Probado con la emulación de dispositivos de Chrome DevTools (390×844, 1920×1080).
- Estados offline / reconectando / servidor caído con indicador visible y mensajes amigables.
- Detalles: [`docs/responsive-design.md`](docs/responsive-design.md).

## Órdenes y flujo de cocina

```text
DRAFT ──▶ SENT ──▶ RECEIVED ──▶ PREPARING ──▶ READY ──▶ DELIVERED ──▶ COMPLETED
   └────────────────────────▶ CANCELLED ◀────────────┘
```

- Cada transición exige un **permiso específico** y se valida en el backend (no se confía en el frontend).
- **Mesero**: crea el pedido por mesa, agrega ítems/notas, envía a cocina, marca entregado.
- **Cocina**: recibe, marca "preparando" y "lista" → notificación automática al mesero.
- **Cajero**: ve órdenes y cierra/completa. **Manager/Admin**: historial completo.
- Historial de estados por orden (`OrderStatusHistory`) para auditoría.

Detalle completo: [`docs/orders.md`](docs/orders.md).

## Empleados, roles y permisos

- Roles base configurables: **Administrator, Manager, Supervisor, Waiter, Kitchen Staff, Cashier, Employee** (renombrables; permisos editables desde la UI y aplicados por el servidor en el próximo request).
- Resolución de permisos en servidor: overrides del usuario ⊕ permisos del rol (DB) ⊕ defaults del sistema.
- Empleados creados **solo por administradores** — no existe auto-registro.

Detalle: [`docs/roles-and-permissions.md`](docs/roles-and-permissions.md).

## Tiempo real

Eventos broadcast por socket.io a través del gateway:

```text
order.created · order.updated · order.ready · order.delivered
message.created · notification.created
```

- Reconexión automática con backoff, indicador Online/Offline en el header.
- Al marcar una orden **lista**, el servidor notifica al mesero dueño de la orden.

## Módulos de soporte

- **Chat** — conversaciones grupales, mensajes en vivo, no leídos.
- **Quejas** — `Open → In Progress → Resolved → Closed` con asignación.
- **Servicio al cliente** — requests con canal (teléfono/online/presencial) y estado.
- **Asistencia** — check-in/check-out con fecha, estado y usuario.
- **Notificaciones** — por usuario, badge de no leídas + toasts en vivo.

## Configuración JSON por restaurante

```json
{
  "restaurant": { "name": "Café Sakura", "id": "cafe_sakura", "logo": null },
  "branding": {
    "primaryColor": "#E85D75",
    "secondaryColor": "#FFFFFF",
    "accentColor": "#FFB7C5"
  },
  "features": {
    "orders": true, "employees": true, "complaints": true,
    "customerService": true, "chat": true, "attendance": true,
    "tables": true, "notifications": true
  },
  "localization": { "defaultLanguage": "es", "supportedLanguages": ["es", "en"] },
  "server": { "version": "1.0.0-mvp", "realtimePort": 3003 }
}
```

- Si `features.chat = false`, el módulo Chat **desaparece** de la navegación. Lo mismo para el resto.
- Branding aplicado en vivo (CSS custom properties): logo, color primario/acento, splash.
- Referencia completa de campos: [`docs/configuration.md`](docs/configuration.md).

## Localización (ES/EN)

- Español por defecto, inglés incluido; **ningún string visible está hardcodeado**.
- Diccionarios con claves tipadas (`login.title`, `orders.markReady`, `admin.warning`…, 278 claves por idioma) en `src/lib/i18n.ts`.
- Cambiar un texto = editar el JSON/diccionario, sin tocar código de la app.
- Guía para agregar idiomas: [`docs/localization.md`](docs/localization.md).

## Pantalla de inicio (splash) y branding

- Splash **obligatorio** en cada arranque (browser/Windows/Android): logo del restaurante si existe, si no **ServeHub**, con los colores configurados → transición a la app.

## Modo desarrollador (F10) y vista previa móvil

- **F10** (escritorio, con permiso `developer.access`) abre el panel:
  - estado del servidor (API / DB / realtime), conteos por tabla
  - configuración activa + feature flags + roles y sus permisos
  - **recargar configuración** y **re-sembrar datos demo** (POST /api/developer)
  - **vista previa móvil 390×844** para probar el layout desde el escritorio
- El modo desarrollador es independiente del modo administrador.
- Sin permiso, F10 muestra un error y no hace nada.

## Inicio rápido

Requisitos: [Bun](https://bun.sh) ≥ 1.0 (o Node.js ≥ 18 con npm).

```bash
# 1) instalar dependencias
bun install            # ó: npm install

# 2) crear/esquematizar la base de datos SQLite
bun run db:push        # ó: npm run db:push

# 3) datos demo (Café Sakura)
bun run scripts/seed.ts

# 4) servicio de tiempo real (socket.io :3003 + bridge :3004)
cd mini-services/realtime && bun install && bun --hot index.ts &

# 5) app web
bun run dev            # http://localhost:3000
```

> En despliegues con gateway/Caddy, los clientes socket.io conectan con `io("/?XTransformPort=3003")`. En desarrollo local directo también funciona porque el gateway mapea el query param al puerto.

Estructura del proyecto:

```text
src/
├── app/
│   ├── page.tsx              # única ruta visible (app shell + splash + login)
│   └── api/                  # REST API (auth, orders, tables, chat, …)
├── components/               # shell responsive, splash, login, vistas
│   └── views/                # dashboard, orders, tables, employees, …
├── lib/
│   ├── auth.ts               # Argon2 + sesiones
│   ├── authz.ts              # resolución de permisos (server)
│   ├── permissions.ts        # catálogo de permisos y defaults por rol
│   ├── order-state.ts        # máquina de estados de órdenes
│   ├── api-client.ts         # capa única frontend → API
│   ├── i18n.ts               # diccionarios ES/EN tipados
│   ├── store.ts              # estado global (Zustand)
│   └── use-realtime.ts       # socket singleton (socket.io)
└── hooks/
mini-services/realtime/       # socket.io :3003 + bridge :3004
prisma/schema.prisma          # 16 modelos SQLite
scripts/seed.ts               # datos demo
docs/                         # documentación completa
```

## Credenciales demo

> ⚠️ **Solo para desarrollo/demo.** Cambia estas credenciales antes de usar en producción.

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `admin` | `0000` | Administrator |
| `manager01` | `0000` | Manager |
| `waiter01` | `0000` | Waiter |
| `waiter02` | `0000` | Waiter |
| `kitchen01` | `0000` | Kitchen Staff |
| `cashier01` | `0000` | Cashier |

Las contraseñas se almacenan **únicamente como hash Argon2id**.

## Builds de producción

```bash
bun run build    # next build (standalone) + assets
bun run start    # sirve la build de producción
bun run lint     # ESLint
```

## Windows y Android (Tauri 2)

La ruta oficial para empaquetar la **misma** aplicación:

- **Windows (.exe/.msi)**: shell de escritorio orientado a administración, 16:9, F10 activo.
- **Android (.apk)**: shell móvil 9:16 orientado a empleados; conecta al PC del restaurante por Wi-Fi/LAN.

```bash
bun add -D @tauri-apps/cli
bun tauri init       # frontendDist apuntando a la build/servidor web
bun tauri build      # Windows
bun tauri android init && bun tauri android build   # Android
```

> En este MVP los binarios Tauri no se compilaron (el entorno de desarrollo no cuenta con toolchain Rust/Android); los pasos completos, `tauri.conf.json` de referencia y estrategias de conexión están documentados en [`docs/tauri.md`](docs/tauri.md).

## Redes: el PC del restaurante es el servidor

```text
Android (meseros/cocina)          Windows PC (administración)
        │                                  │
        └──────────── Wi-Fi / LAN ─────────┤
                                           ▼
                              ServeHub Server (API + WS)
                                           │
                                        SQLite
```

- El servidor escucha en el PC del restaurante; los móviles apuntan a `http://<IP-LAN>:<puerto>`.
- Sin nube requerida para operar; la arquitectura no impide migrar a cloud después.

## Documentación completa

| Doc | Contenido |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura, flujos, decisión de stack |
| [`docs/api.md`](docs/api.md) | Referencia completa de endpoints con ejemplos |
| [`docs/database.md`](docs/database.md) | Modelo de datos, 16 tablas, relaciones |
| [`docs/orders.md`](docs/orders.md) | Máquina de estados, permisos por transición |
| [`docs/roles-and-permissions.md`](docs/roles-and-permissions.md) | Roles, matriz de permisos |
| [`docs/configuration.md`](docs/configuration.md) | JSON de configuración y feature flags |
| [`docs/localization.md`](docs/localization.md) | i18n, cómo agregar idiomas |
| [`docs/responsive-design.md`](docs/responsive-design.md) | Breakpoints, navegación adaptativa |
| [`docs/security.md`](docs/security.md) | Argon2, sesiones, límites del MVP |
| [`docs/development.md`](docs/development.md) | Setup, scripts, troubleshooting |
| [`docs/tauri.md`](docs/tauri.md) | Empaquetado Windows/Android (roadmap) |
| [`docs/deployment.md`](docs/deployment.md) | Despliegue LAN, servicios, checklist |

## Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `500` en `/api/*` y no hay DB | Falta `db push` / DB vacía | `bun run db:push && bun run scripts/seed.ts` |
| Header muestra **Offline** | Servicio realtime caído o gateway sin ruta WS | Levanta `mini-services/realtime` y revisa el gateway (`XTransformPort=3003`) |
| Login falla con credenciales demo | DB sin sembrar | `bun run scripts/seed.ts` |
| F10 no abre el panel | Usuario sin `developer.access` | Usa `admin` |
| Puerto 3000 ocupado | Otro proceso | `PORT=3001 bun run dev` (o detén el previo) |
| Cambié un texto y no aparece | Cache del navegador | Recarga con cache deshabilitado |

## Arquitectura futura en la nube

Fuera del alcance del MVP, pero la arquitectura no la bloquea:

```text
Android / Windows / Browser
          │ Internet
          ▼
  Cloudflare / Dominio
          ▼
    ServeHub Cloud (API + WS + DB)
```

Cada restaurante podrá elegir **servidor local** o **cloud** sin reescribir la app: el frontend solo conoce la URL base del API (`src/lib/api-client.ts`).

## Contribuir

1. Haz fork y crea una rama: `git checkout -b feature/mi-feature`
2. Commits con formato [Conventional Commits](https://www.conventionalcommits.org/es/): `feat:`, `fix:`, `docs:`, `chore:`
3. Ejecuta `bun run lint` antes del PR
4. Describe claramente el cambio y capturas si afecta UI

## Licencia

MIT — ver [`LICENSE`](LICENSE).
