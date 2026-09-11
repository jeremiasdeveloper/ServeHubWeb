// ServeHub — seed core
//
// Two clearly separated layers:
//
//   seedProductionBaseline() — runs automatically on an empty database at
//   server boot. Creates ONLY the Spanish system roles (modular; editable
//   at runtime) and the stable server identity. NO users, NO demo orders,
//   NO chat history. A clean production install starts empty; the first
//   administrator is created through the first-run setup wizard
//   (POST /api/setup).
//
//   seedDemoData() — explicit DEVELOPMENT/TEST data (users with password
//   0000, tables, sample orders, chat, complaints, attendance...). Only
//   invoked through developer tooling: scripts/seed.ts or the Developer
//   Mode panel (requires developer.access). Never in a normal boot.

import { db } from "./db"
import { hashPassword } from "./auth"
import { ROLE_PERMISSIONS } from "./permissions"
import { getServerIdentity } from "./server-identity"

export interface SeedResult {
  roles: number
  users: number
  tables: number
  orders: number
}

// ---- Production baseline ----------------------------------------------------

export const SYSTEM_ROLES = [
  { name: "Administrador", description: "Acceso total al sistema" },
  { name: "Gerente", description: "Gestión operativa del restaurante" },
  { name: "Supervisor", description: "Supervisión de turnos y órdenes" },
  { name: "Mesero", description: "Mesero — toma y entrega de órdenes" },
  { name: "Cocina", description: "Cocina — preparación de órdenes" },
  { name: "Cajero", description: "Caja — cobro y cierre de órdenes" },
  { name: "Empleado", description: "Empleado base" },
]

export async function seedProductionBaseline(): Promise<{ roles: number }> {
  for (const r of SYSTEM_ROLES) {
    await db.role.upsert({
      where: { name: r.name },
      update: { description: r.description, isSystem: true },
      create: { name: r.name, description: r.description, isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS[r.name] ?? []) },
    })
  }
  // Stable installation identity (generated once, persisted forever).
  await getServerIdentity()
  return { roles: SYSTEM_ROLES.length }
}

// ---- Demo / test data (development only) ------------------------------------

export async function seedDemoData(): Promise<SeedResult> {
  const result: SeedResult = { roles: 0, users: 0, tables: 0, orders: 0 }

  console.log("🌱 [DEV] Seeding ServeHub DEMO data (development/test only)...")
  await seedProductionBaseline()
  result.roles = SYSTEM_ROLES.length

  // ---- Users (password: 0000) --------------------------------------------
  const pw = await hashPassword("0000")
  const roleByName: Record<string, { id: string }> = {}
  for (const r of await db.role.findMany()) roleByName[r.name] = r

  const userDefs = [
    { username: "admin", displayName: "Administrador", role: "Administrador", email: "admin@demo.test" },
    { username: "manager01", displayName: "Manager01", role: "Gerente", email: "manager01@demo.test" },
    { username: "waiter01", displayName: "Waiter01", role: "Mesero", email: "waiter01@demo.test" },
    { username: "waiter02", displayName: "Waiter02", role: "Mesero", email: "waiter02@demo.test" },
    { username: "kitchen01", displayName: "Kitchen01", role: "Cocina", email: "kitchen01@demo.test" },
    { username: "cashier01", displayName: "Cashier01", role: "Cajero", email: "cashier01@demo.test" },
  ]
  const userByUsername: Record<string, { id: string; username: string; displayName: string; roleId: string }> = {}
  for (const u of userDefs) {
    const user = await db.user.upsert({
      where: { username: u.username },
      update: { displayName: u.displayName, roleId: roleByName[u.role].id, email: u.email, passwordHash: pw, active: true },
      create: { username: u.username, displayName: u.displayName, roleId: roleByName[u.role].id, email: u.email, passwordHash: pw, permissions: "[]" },
    })
    userByUsername[u.username] = user
  }
  result.users = userDefs.length
  console.log(`✓ ${result.users} demo users (password: 0000)`)

  // ---- Tables --------------------------------------------------------------
  const tableStatuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "NEEDS_CLEANING", "AVAILABLE", "OCCUPIED", "AVAILABLE", "AVAILABLE", "OCCUPIED", "AVAILABLE", "RESERVED", "AVAILABLE"]
  const tableIds: string[] = []
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0")
    const t = await db.table.upsert({
      where: { number: num },
      update: { status: tableStatuses[i - 1] ?? "AVAILABLE" },
      create: { number: num, capacity: 4, status: tableStatuses[i - 1] ?? "AVAILABLE", location: i <= 6 ? "Salón principal" : "Terraza" },
    })
    tableIds.push(t.id)
  }
  result.tables = tableIds.length

  // ---- Menu (demo catalog) --------------------------------------------------
  const catEntradas = await db.menuCategory.upsert({
    where: { name: "Entradas" }, update: {}, create: { name: "Entradas", sortOrder: 1 },
  })
  const catPlatos = await db.menuCategory.upsert({
    where: { name: "Platos" }, update: {}, create: { name: "Platos", sortOrder: 2 },
  })
  const catBebidas = await db.menuCategory.upsert({
    where: { name: "Bebidas" }, update: {}, create: { name: "Bebidas", sortOrder: 3 },
  })
  const catPostres = await db.menuCategory.upsert({
    where: { name: "Postres" }, update: {}, create: { name: "Postres", sortOrder: 4 },
  })
  const menuItems: { name: string; categoryId: string; price: number; description: string }[] = [
    { name: "Gyozas (6u)", categoryId: catEntradas.id, price: 6.0, description: "Dumplings de cerdo y verdura" },
    { name: "Edamame", categoryId: catEntradas.id, price: 4.0, description: "Habas de soja al vapor con sal" },
    { name: "Ramen de Pollo", categoryId: catPlatos.id, price: 8.5, description: "Caldo de pollo, fideos, huevo y cebollín" },
    { name: "Ramen de Cerdo", categoryId: catPlatos.id, price: 9.0, description: "Caldo tonkotsu, chashu y nori" },
    { name: "Ramen Vegetariano", categoryId: catPlatos.id, price: 8.0, description: "Caldo de verduras y tofu" },
    { name: "Coca-Cola", categoryId: catBebidas.id, price: 2.0, description: "500 ml" },
    { name: "Té Verde", categoryId: catBebidas.id, price: 2.5, description: "Matcha tradicional" },
    { name: "Agua Mineral", categoryId: catBebidas.id, price: 1.5, description: "600 ml" },
    { name: "Sake", categoryId: catBebidas.id, price: 5.0, description: "Copa 180 ml" },
    { name: "Pastel de Fresa", categoryId: catPostres.id, price: 4.5, description: "Shortcake japonés" },
  ]
  for (const it of menuItems) {
    await db.menuItem.upsert({ where: { name: it.name }, update: { price: it.price }, create: it })
  }

  // ---- Orders ---------------------------------------------------------------
  await db.orderStatusHistory.deleteMany()
  await db.orderItem.deleteMany()
  await db.order.deleteMany()

  const now = Date.now()
  const orders = [
    {
      tableIdx: 1, createdBy: "waiter01", assignedTo: "kitchen01", status: "PREPARING",
      notes: "Sin cebolla en el ramen",
      items: [
        { name: "Ramen de Pollo", quantity: 2, price: 8.5, notes: "sin cebolla" },
        { name: "Coca-Cola", quantity: 1, price: 2.0 },
        { name: "Pastel de Fresa", quantity: 1, price: 4.5 },
      ],
      ageMs: 1000 * 60 * 8,
    },
    {
      tableIdx: 4, createdBy: "waiter01", assignedTo: "kitchen01", status: "READY",
      notes: "Cliente con prisa",
      items: [
        { name: "Ramen Vegetariano", quantity: 1, price: 8.0 },
        { name: "Té Verde", quantity: 2, price: 2.5 },
      ],
      ageMs: 1000 * 60 * 18,
    },
    {
      tableIdx: 8, createdBy: "waiter02", assignedTo: "kitchen01", status: "SENT",
      items: [
        { name: "Gyozas (6u)", quantity: 2, price: 6.0 },
        { name: "Sake", quantity: 1, price: 5.0 },
      ],
      ageMs: 1000 * 60 * 2,
    },
    {
      tableIdx: 2, createdBy: "waiter02", assignedTo: null, status: "DELIVERED",
      items: [
        { name: "Ramen de Cerdo", quantity: 1, price: 9.0 },
        { name: "Agua Mineral", quantity: 1, price: 1.5 },
      ],
      ageMs: 1000 * 60 * 45,
    },
    {
      tableIdx: 5, createdBy: "waiter01", assignedTo: null, status: "COMPLETED",
      items: [
        { name: "Ramen de Pollo", quantity: 2, price: 8.5 },
        { name: "Gyozas (6u)", quantity: 2, price: 6.0 },
      ],
      ageMs: 1000 * 60 * 120,
    },
  ]

  let orderNumber = 1040
  for (const o of orders) {
    orderNumber++
    const total = o.items.reduce((s, it) => s + it.price * it.quantity, 0)
    const createdAt = new Date(now - o.ageMs)
    const order = await db.order.create({
      data: {
        number: orderNumber,
        tableId: tableIds[o.tableIdx],
        createdById: userByUsername[o.createdBy].id,
        assignedToId: o.assignedTo ? userByUsername[o.assignedTo].id : null,
        status: o.status,
        notes: o.notes ?? null,
        total,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 60000),
        items: { create: o.items },
      },
    })
    await db.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: null, toStatus: "DRAFT", changedById: userByUsername[o.createdBy].id, createdAt },
    })
    if (o.status !== "DRAFT") {
      await db.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: "DRAFT", toStatus: o.status, changedById: userByUsername[o.createdBy].id, createdAt: new Date(createdAt.getTime() + 30000) },
      })
    }
  }
  result.orders = orders.length

  // ---- Conversations & messages ---------------------------------------------
  await db.message.deleteMany()
  await db.conversationParticipant.deleteMany()
  await db.conversation.deleteMany()
  const allChat = await db.conversation.create({ data: { name: "Chat general", isGroup: true } })
  const participants = ["admin", "manager01", "waiter01", "kitchen01", "cashier01"]
  for (const p of participants) {
    await db.conversationParticipant.create({ data: { conversationId: allChat.id, userId: userByUsername[p].id } })
  }
  const sampleMsgs = [
    { sender: "manager01", content: "Buenos días equipo, turno iniciado.", mins: 60 },
    { sender: "kitchen01", content: "Cocina lista, stock de ramen completo.", mins: 58 },
    { sender: "waiter01", content: "Mesa 12 pide 2 ramen sin cebolla.", mins: 10 },
    { sender: "kitchen01", content: "Anotado, en preparación.", mins: 9 },
    { sender: "admin", content: "Recuerden marcar órdenes listas a tiempo.", mins: 5 },
  ]
  for (const m of sampleMsgs) {
    await db.message.create({
      data: {
        conversationId: allChat.id,
        senderId: userByUsername[m.sender].id,
        content: m.content,
        createdAt: new Date(now - m.mins * 60000),
      },
    })
  }

  // ---- Complaints ------------------------------------------------------------
  await db.complaint.deleteMany()
  const complaints = [
    { title: "Espera prolongada — Mesa 03", desc: "El cliente esperó 30 minutos por su orden.", category: "WAIT_TIME", priority: "HIGH", status: "OPEN", createdBy: "waiter01", customerName: "Cliente 142" },
    { title: "Sopa poco salada", desc: "Cliente indica que el ramen estaba desabrido.", category: "FOOD", priority: "NORMAL", status: "IN_PROGRESS", createdBy: "manager01", assignedTo: "kitchen01", customerName: "Cliente 118" },
    { title: "Factura incorrecta", desc: "Se cobró un extra en la mesa 07.", category: "BILLING", priority: "NORMAL", status: "RESOLVED", createdBy: "cashier01", assignedTo: "manager01", customerName: "Cliente 099" },
  ]
  for (const c of complaints) {
    await db.complaint.create({
      data: {
        title: c.title,
        description: c.desc,
        category: c.category,
        priority: c.priority,
        status: c.status,
        createdById: userByUsername[c.createdBy].id,
        assignedToId: c.assignedTo ? userByUsername[c.assignedTo].id : null,
        customerName: c.customerName,
        resolution: c.status === "RESOLVED" ? "Resuelto con el cliente, se aplicó descuento." : null,
      },
    })
  }

  // ---- Customer service --------------------------------------------------------
  await db.customerService.deleteMany()
  await db.customerService.createMany({
    data: [
      { subject: "Consulta de reserva", description: "Cliente pregunta por reserva para 8 personas el sábado.", channel: "PHONE", customerName: "Ana López", customerContact: "+56 9 1234 5678", status: "OPEN" },
      { subject: "Sugerencia de menú", description: "Cliente sugiere agregar opción vegana.", channel: "ONLINE", customerName: "Pedro Ruiz", customerContact: "pedro@email.com", status: "IN_PROGRESS" },
      { subject: "Felicitaciones al chef", description: "Cliente felicita por el ramen.", channel: "IN_PERSON", customerName: "María Soto", status: "RESOLVED" },
    ],
  })

  // ---- Attendance (today) --------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10)
  for (const u of ["admin", "manager01", "waiter01", "waiter02", "kitchen01", "cashier01"]) {
    const checkIn = new Date(now - 1000 * 60 * 60 * 4)
    const checkOut = u === "waiter02" ? new Date(now - 1000 * 60 * 30) : null
    await db.attendance.upsert({
      where: { userId_date: { userId: userByUsername[u].id, date: today } },
      update: {},
      create: {
        userId: userByUsername[u].id,
        date: today,
        checkIn,
        checkOut,
        status: checkOut ? "HALF_DAY" : "PRESENT",
      },
    })
  }

  // ---- Notifications -----------------------------------------------------------
  await db.notification.deleteMany()
  await db.notification.createMany({
    data: [
      { userId: userByUsername["waiter01"].id, type: "ORDER_READY", title: "Orden lista", body: "La orden #1041 de la Mesa 04 está lista para entregar.", data: JSON.stringify({ orderId: "demo", tableNumber: "04" }), read: false },
      { userId: userByUsername["waiter01"].id, type: "NEW_MESSAGE", title: "Nuevo mensaje", body: "Kitchen01: Anotado, en preparación.", read: false },
      { userId: userByUsername["manager01"].id, type: "COMPLAINT_ASSIGNED", title: "Queja asignada", body: "Se te asignó la queja: Sopa poco salada.", read: false },
      { userId: userByUsername["admin"].id, type: "SYSTEM", title: "Modo desarrollador", body: "Datos demo cargados (solo desarrollo).", read: true },
    ],
  })

  console.log("🎉 [DEV] Demo seed complete.")
  return result
}

// Backwards-compatible alias used by scripts/seed.ts (demo tooling).
export async function seedDatabase(): Promise<SeedResult> {
  return seedDemoData()
}
