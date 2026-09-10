"use client"

// ServeHub — realtime socket.io hook (singleton socket manager)
//
// Connects to the mini-service via Caddy: io("/?XTransformPort=3003")
//
// A single shared socket is created per authenticated user. Every hook
// consumer attaches its own event listener; the underlying socket stays
// alive across view changes (ref-counted listeners only). The connection
// status flag in the store is therefore owned exclusively by the manager,
// which avoids flickering when views mount/unmount.
//
// Reconnection policy: attempts are CAPPED with exponential backoff. An
// unbounded 1-second retry loop spams the console with "Failed to fetch"
// forever whenever the realtime endpoint becomes unreachable (idle proxy
// timeout, laptop sleep, network switch...). After the cap is reached the
// manager goes quiet and self-heals: as soon as the user refocuses the tab
// or the network comes back, connection is retried automatically.

import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { useApp } from "./store"

export interface RealtimeEvent {
  type: "order.created" | "order.updated" | "order.ready" | "order.delivered" | "message.created" | "notification.created"
  [k: string]: unknown
}

type EventListener = (e: RealtimeEvent) => void

interface ManagedSocket {
  socket: Socket
  userId: string
  listeners: Set<EventListener>
  recoveryInstalled: boolean
}

const MAX_RECONNECT_ATTEMPTS = 8
const RECONNECT_DELAY_MAX_MS = 15000

let managed: ManagedSocket | null = null

// Install (once per socket) self-healing triggers: refocus tab, come back
// online, or become visible after being hidden → retry connecting.
function installRecovery(socket: Socket) {
  if (managed?.recoveryInstalled) return

  const tryRecover = () => {
    if (!managed || managed.socket !== socket) return
    if (!socket.connected && !socket.active) {
      // socket.active === false means engine.io gave up reconnecting
      socket.connect()
    }
  }

  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") tryRecover()
  }

  window.addEventListener("focus", tryRecover)
  window.addEventListener("online", tryRecover)
  document.addEventListener("visibilitychange", onVisibility)

  if (managed) managed.recoveryInstalled = true
}

function acquireSocket(userId: string): Socket {
  if (managed && managed.userId === userId) return managed.socket

  // user changed (login as someone else) — tear down previous socket
  releaseSocket()

  const socket = io("/?XTransformPort=3003", {
    path: "/",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 10000,
  })

  const setRealtimeConnected = useApp.getState().setRealtimeConnected

  socket.on("connect", () => {
    setRealtimeConnected(true)
    socket.emit("servehub:subscribe", { userId })
  })
  socket.on("disconnect", () => setRealtimeConnected(false))
  socket.io.on("reconnect_attempt", () => setRealtimeConnected(false))
  socket.io.on("reconnect", () => setRealtimeConnected(true))
  // engine.io exhausted its attempts — stay offline silently until the
  // user refocuses the tab / network recovers (installRecovery).
  socket.io.on("reconnect_failed", () => setRealtimeConnected(false))

  managed = { socket, userId, listeners: new Set(), recoveryInstalled: false }
  installRecovery(socket)
  return socket
}

export function releaseSocket() {
  if (managed) {
    managed.socket.removeAllListeners()
    managed.socket.disconnect()
    useApp.getState().setRealtimeConnected(false)
    managed = null
  }
}

export function useRealtime(onEvent?: EventListener) {
  const user = useApp((s) => s.user)
  const handlerRef = useRef<EventListener | undefined>(undefined)

  useEffect(() => {
    handlerRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!user) return
    const socket = acquireSocket(user.id)
    const listener: EventListener = (e) => handlerRef.current?.(e)

    if (handlerRef.current) {
      socket.on("servehub:event", listener)
      socket.on("servehub:notify", listener)
    }

    return () => {
      socket.off("servehub:event", listener)
      socket.off("servehub:notify", listener)
    }
  }, [user?.id])

  return managed?.socket ?? null
}
