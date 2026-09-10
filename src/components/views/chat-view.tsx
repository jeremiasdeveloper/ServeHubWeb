"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useApp } from "@/lib/store"
import { api } from "@/lib/api-client"
import type { ConversationInfo, MessageInfo, EmployeeInfo } from "@/lib/types"
import { Loading, ErrorState, EmptyState } from "./view-primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageCircle, Send, Plus, Users, ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/lib/use-realtime"

export function ChatView() {
  const t = useApp((s) => s.t)
  const user = useApp((s) => s.user)!
  const mobilePreview = useApp((s) => s.mobilePreview)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationInfo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageInfo[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const threadRef = useRef<HTMLDivElement>(null)
  const autoSelectedRef = useRef(false)

  // Load the conversation list. Deliberately independent from activeId so
  // opening/leaving a conversation never re-triggers a full reload (the old
  // coupling made the mobile "back" button bounce back into a conversation).
  const loadConversations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const [c, e] = await Promise.all([
          api.conversations(),
          api.employees().catch(() => ({ employees: [] as EmployeeInfo[], roles: [] })),
        ])
        setConversations(c.conversations)
        setEmployees(e.employees)
        return c.conversations
      } catch (e) {
        if (!opts?.silent) setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
        return null
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [t]
  )

  // Initial load + one-time auto-select on wide screens only. Phones stay on
  // the conversation list until the user taps one (standard mobile chat UX).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await loadConversations()
      if (cancelled || !list || list.length === 0) return
      const previewOn = useApp.getState().mobilePreview
      if (!autoSelectedRef.current && !previewOn && typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
        autoSelectedRef.current = true
        setActiveId((cur) => cur ?? list[0].id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadConversations])

  // Messages for the active conversation (keyed on activeId only)
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    api
      .messages(activeId)
      .then((r) => {
        if (!cancelled) setMessages(r.messages)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : t("errors.unknown"))
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId, t])

  // Keep the thread pinned to the newest message. Scoped to the scroll
  // container (scrollTop) instead of scrollIntoView, which could scroll the
  // whole page on mobile.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activeId])

  // realtime: refresh on new messages
  useRealtime((e) => {
    if (e.type === "message.created") {
      if (e.conversationId === activeId && typeof e.conversationId === "string") {
        api
          .messages(e.conversationId)
          .then((r) => setMessages(r.messages))
          .catch(() => {})
      }
      loadConversations({ silent: true })
    } else if (e.type === "notification.created" && e.ntype === "NEW_MESSAGE") {
      loadConversations({ silent: true })
    }
  })

  const send = async () => {
    if (!activeId || !draft.trim()) return
    setSending(true)
    try {
      await api.sendMessage(activeId, draft.trim())
      setDraft("")
      const r = await api.messages(activeId)
      setMessages(r.messages)
      loadConversations({ silent: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSending(false)
    }
  }

  if (loading && conversations.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={() => loadConversations()} />

  const active = conversations.find((c) => c.id === activeId)

  return (
    // Height: bounded to the visible viewport minus the shell chrome, so the
    // composer input is always visible above the mobile bottom nav.
    // - phones: header 3.5rem + padding 2rem + bottom-nav clearance 5rem = 10.5rem
    // - desktop (@md container): header + footer ≈ 9rem
    // - mobile preview frame: exactly the frame's inner area
    <div
      className={cn(
        "flex flex-col min-h-0",
        mobilePreview
          ? "h-[calc(min(844px,80vh)-2.5rem)]"
          : "h-[calc(100dvh-10.5rem)] @md:h-[calc(100dvh-9rem)]"
      )}
    >
      {/* Compact header (saves vertical space on phones) */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight truncate">{t("chat.title")}</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              <span className="truncate max-w-[150px] @md:max-w-none">{t("chat.newConversation")}</span>
            </Button>
          </DialogTrigger>
          <NewConversationDialog
            employees={employees.filter((e) => e.id !== user.id && e.active)}
            onClose={() => setCreateOpen(false)}
            onCreated={(id) => {
              setActiveId(id)
              loadConversations()
            }}
          />
        </Dialog>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 @md:grid-cols-3 gap-4">
        {/* Conversation list */}
        <Card
          className={cn(
            "@md:col-span-1 flex flex-col min-h-0 gap-0 overflow-hidden py-0",
            activeId && "hidden @md:flex"
          )}
        >
          <CardContent className="flex-1 min-h-0 p-0">
            {conversations.length === 0 ? (
              <EmptyState icon={MessageCircle} title={t("chat.noConversations")} />
            ) : (
              <div className="h-full overflow-y-auto scroll-thin divide-y">
                {conversations.map((c) => {
                  const others = c.participants.filter((p) => p.user.id !== user.id)
                  const name = c.isGroup ? c.name ?? t("chat.group") : others[0]?.user.displayName ?? "—"
                  const last = c.messages?.[0]
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors",
                        c.id === activeId && "bg-accent"
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback
                          className={cn("text-xs font-bold", c.isGroup ? "bg-primary/10 text-primary" : "bg-secondary")}
                        >
                          {c.isGroup ? <Users className="h-4 w-4" /> : name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate">{name}</span>
                          {last && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(last.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        {last && <p className="text-xs text-muted-foreground truncate">{last.content}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message thread */}
        <Card
          className={cn(
            "@md:col-span-2 flex flex-col min-h-0 gap-0 overflow-hidden py-0",
            !activeId && "hidden @md:flex"
          )}
        >
          {active ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="@md:hidden h-8 w-8 shrink-0"
                  onClick={() => setActiveId(null)}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-bold",
                      active.isGroup ? "bg-primary/10 text-primary" : "bg-secondary"
                    )}
                  >
                    {active.isGroup ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      (active.participants.find((p) => p.user.id !== user.id)?.user.displayName ?? "?")
                        .slice(0, 2)
                        .toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {active.isGroup
                      ? active.name ?? t("chat.group")
                      : active.participants.find((p) => p.user.id !== user.id)?.user.displayName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {active.participants.map((p) => p.user.displayName).join(", ")}
                  </div>
                </div>
              </div>

              <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState icon={MessageCircle} title={t("chat.empty")} />
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => {
                      const mine = m.senderId === user.id
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[78%] rounded-2xl px-3 py-2",
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            )}
                          >
                            {!mine && <div className="mb-0.5 text-[10px] font-bold opacity-80">{m.sender.displayName}</div>}
                            <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                            <div
                              className={cn(
                                "mt-0.5 text-[10px]",
                                mine ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}
                            >
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-2 border-t bg-card p-2.5 @md:p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder={t("chat.typeMessage")}
                  disabled={sending}
                  className="h-10 text-base @md:text-sm"
                  aria-label={t("chat.typeMessage")}
                />
                <Button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label={t("chat.send")}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <EmptyState icon={MessageCircle} title={t("chat.selectConversation")} />
          )}
        </Card>
      </div>
    </div>
  )
}

function NewConversationDialog({
  employees,
  onClose,
  onCreated,
}: {
  employees: EmployeeInfo[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const t = useApp((s) => s.t)
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 9 ? [...prev, id] : prev))
  }

  const submit = async () => {
    if (selected.length === 0) return
    setSaving(true)
    try {
      const r = await api.createConversation({
        participantIds: selected,
        name: name || undefined,
        isGroup: selected.length > 1,
      })
      toast.success(t("chat.newConversation"))
      onCreated(r.conversation.id)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("chat.newConversation")}</DialogTitle>
        <DialogDescription>{t("chat.startWith")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {selected.length > 1 && (
          <div className="space-y-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("chat.group")} />
          </div>
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto scroll-thin">
          {employees.map((e) => (
            <label
              key={e.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-accent/50",
                selected.includes(e.id) && "border-primary bg-primary/5"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(e.id)}
                onChange={() => toggle(e.id)}
                className="h-4 w-4"
              />
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">
                  {e.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{e.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{e.role.name}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} disabled={saving || selected.length === 0}>
          {t("common.create")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
