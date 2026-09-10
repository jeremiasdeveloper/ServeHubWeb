// ServeHub — realtime event bridge
// API routes call emitRealtime() to push events into the socket.io mini-service.
// The mini-service (port 3003) re-broadcasts to connected clients.

export type RealtimeEvent =
  | { type: "order.created"; orderId: string; tableNumber: string; status: string }
  | { type: "order.updated"; orderId: string; from: string; to: string; tableNumber: string }
  | { type: "order.ready"; orderId: string; tableNumber: string; assignedToId?: string }
  | { type: "order.delivered"; orderId: string; tableNumber: string }
  | { type: "message.created"; conversationId: string; senderId: string; senderName: string; content: string }
  | { type: "notification.created"; userId: string; title: string; body: string; ntype: string }

// In-memory pub/sub bus so the Next.js API routes and the socket.io mini-service
// (which is a separate process) can communicate. We use an HTTP push to the mini-service.
const REALTIME_BRIDGE_URL = "http://localhost:3004/bridge"

export async function emitRealtime(event: RealtimeEvent): Promise<void> {
  try {
    await fetch(REALTIME_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    })
  } catch {
    // mini-service may be down; fail silently so API routes still work.
  }
}
