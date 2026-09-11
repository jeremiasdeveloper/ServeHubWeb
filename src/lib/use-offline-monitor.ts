"use client"

// ServeHub — connectivity monitor
// Distinguishes "ServeHub server reachable" from "internet available".
// When the server cannot be reached, the app enters offline read-only mode:
// api-client blocks all write operations and the shell shows a banner.
// Reads keep working with already-synchronized state.

import { useEffect } from "react"
import { useApp } from "./store"
import { getApiBase } from "./connection"
import { setOfflineMode } from "./api-client"

export function setServerReachable(v: boolean) {
  setOfflineMode(!v)
  useApp.setState({ serverReachable: v })
}

async function ping(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${getApiBase()}/api/health`, { signal: controller.signal, cache: "no-store" })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

export function useOfflineMonitor() {
  const user = useApp((s) => s.user)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const check = async () => {
      if (cancelled) return
      const ok = await ping()
      if (!cancelled) {
        setServerReachable(ok)
        timer = setTimeout(check, ok ? 20000 : 8000)
      }
    }

    const onOnline = () => { clearTimeout(timer); check() }
    window.addEventListener("online", onOnline)
    check()

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener("online", onOnline)
    }
  }, [user?.id])
}
