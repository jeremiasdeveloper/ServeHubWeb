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
}

let managed: ManagedSocket | null = null

function acquireSocket(userId: string): Socket {
  if (managed && managed.userId === userId) return managed.socket

  // user changed (login as someone else) — tear down previous socket
  releaseSocket()

  const socket = io("/?XTransformPort=3003", {
    path: "/",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  })

  const setRealtimeConnected = useApp.getState().setRealtimeConnected

  socket.on("connect", () => {
    setRealtimeConnected(true)
    socket.emit("servehub:subscribe", { userId })
  })
  socket.on("disconnect", () => setRealtimeConnected(false))
  socket.io.on("reconnect_attempt", () => setRealtimeConnected(false))
  socket.io.on("reconnect", () => setRealtimeConnected(true))

  managed = { socket, userId, listeners: new Set() }
  return socket
}

export function releaseSocket() {
  if (managed) {
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
