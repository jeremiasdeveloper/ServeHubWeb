// ServeHub — stable installation identity
//
// Every ServeHub server has a stable Server ID (e.g. SH-CF9A-8X21) that is
// generated exactly once and persisted in restaurant_settings. It survives
// restarts and is advertised over mDNS so Android clients can tell servers
// apart. The restaurant id (slug) is separate and user-configurable.

import { db } from "./db"

const SERVER_ID_KEY = "server_id"

function randomChunk(len: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"): string {
  let out = ""
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function generateServerId(): string {
  return `SH-${randomChunk(4)}-${randomChunk(4)}`
}

export interface ServerIdentity {
  serverId: string
  restaurantName: string
  port: number
}

// Read (or lazily create) the persistent server identity.
export async function getServerIdentity(): Promise<{ serverId: string }> {
  const existing = await db.restaurantSetting.findUnique({ where: { key: SERVER_ID_KEY } })
  if (existing?.value) return { serverId: existing.value }
  const serverId = generateServerId()
  await db.restaurantSetting.upsert({
    where: { key: SERVER_ID_KEY },
    update: { value: serverId },
    create: { key: SERVER_ID_KEY, value: serverId },
  })
  return { serverId }
}
