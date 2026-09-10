// ServeHub — authentication helpers (Argon2 hashing + session tokens)

import { hash, verify } from "@node-rs/argon2"
import { randomBytes } from "crypto"
import { db } from "./db"

const SESSION_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: 2, // Argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export async function createSession(userId: string): Promise<string> {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.session.create({ data: { token, userId, expiresAt } })
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
  return token
}

export async function getUserFromToken(token: string | undefined | null) {
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { role: true } } },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.user.active) return null
  return session.user
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } }).catch(() => {})
}

// Read session token from a Next.js Request (cookie or Authorization header).
export function extractToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") || ""
  const match = cookie.match(/servehub_token=([^;]+)/)
  if (match) return match[1]
  const auth = req.headers.get("authorization") || ""
  if (auth.startsWith("Bearer ")) return auth.slice(7)
  return null
}

export const SESSION_COOKIE = "servehub_token"

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
