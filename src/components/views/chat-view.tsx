"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useApp } from "@/lib/store"
import { api } from "@/lib/api-client"
import type { ConversationInfo, MessageInfo, EmployeeInfo } from "@/lib/types"
import { PageHeader, Loading, ErrorState, EmptyState } from "./view-primitives"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageCircle, Send, Plus, Users, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/lib/use-realtime"

export function ChatView() {
  const t = useApp((s) => s.t)
  const user = useApp((s) => s.user)!
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationInfo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageInfo[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.conversations()
      setConversations(r.conversations)
      const [c, e] = await Promise.all([
        api.conversations(),
        api.employees().catch(() => ({ employees: [] as EmployeeInfo[], roles: [] })),
      ])
      setConversations(c.conversations)
      setEmployees(e.employees)
      if (!activeId && c.conversations.length > 0) setActiveId(c.conversations[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fetchFailed"))
    } finally {
      setLoading(false)
    }
  }, [activeId, t])

  useEffect(() => { loadConversations() }, [loadConversations])

  const loadMessages = useCallback(async () => {
    if (!activeId) return
    try {
      const r = await api.messages(activeId)
      setMessages(r.messages)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    }
  }, [activeId, t])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // realtime: refresh messages on new message
  useRealtime((e) => {
    if (e.type === "message.created") {
      loadConversations()
      if (e.conversationId === activeId) loadMessages()
    }
    if (e.type === "notification.created" && e.ntype === "NEW_MESSAGE") {
      loadConversations()
    }
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async () => {
    if (!activeId || !draft.trim()) return
    setSending(true)
    try {
      await api.sendMessage(activeId, draft.trim())
      setDraft("")
      await loadMessages()
      await loadConversations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.unknown"))
    } finally {
      setSending(false)
    }
  }

  if (loading && conversations.length === 0) return <Loading />
  if (error) return <ErrorState message={error} onRetry={loadConversations} />

  const active = conversations.find((c) => c.id === activeId)

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-9rem)] flex flex-col">
      <PageHeader
        title={t("chat.title")}
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t("chat.newConversation")}</Button>
            </DialogTrigger>
            <NewConversationDialog employees={employees.filter((e) => e.id !== user.id && e.active)} onClose={() => setCreateOpen(false)} onCreated={(id) => { setActiveId(id); loadConversations() }} />
          </Dialog>
        }
      />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* Conversation list */}
        <Card className={cn("md:col-span-1 flex flex-col", activeId && "hidden md:flex")}>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {conversations.length === 0 ? (
                <EmptyState icon={MessageCircle} title={t("chat.noConversations")} />
              ) : (
                <div className="divide-y">
                  {conversations.map((c) => {
                    const others = c.participants.filter((p) => p.user.id !== user.id)
                    const name = c.isGroup ? (c.name ?? "Grupo") : others[0]?.user.displayName ?? "—"
                    const last = c.messages?.[0]
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setActiveId(c.id); loadMessages() }}
                        className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors", c.id === activeId && "bg-accent")}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={cn("text-xs font-bold", c.isGroup ? "bg-primary/10 text-primary" : "bg-secondary")}>
                            {c.isGroup ? <Users className="h-4 w-4" /> : name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">{name}</span>
                            {last && <span className="text-[10px] text-muted-foreground shrink-0">{new Date(last.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                          </div>
                          {last && <p className="text-xs text-muted-foreground truncate">{last.content}</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message thread */}
        <Card className={cn("md:col-span-2 flex flex-col", !activeId && "hidden md:flex")}>
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b p-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className={cn("text-xs font-bold", active.isGroup ? "bg-primary/10 text-primary" : "bg-secondary")}>
                    {active.isGroup ? <Users className="h-4 w-4" /> : (active.participants.find((p) => p.user.id !== user.id)?.user.displayName ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {active.isGroup ? (active.name ?? t("chat.group")) : active.participants.find((p) => p.user.id !== user.id)?.user.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {active.participants.map((p) => p.user.displayName).join(", ")}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-3">
                {messages.length === 0 ? (
                  <EmptyState icon={MessageCircle} title={t("chat.empty")} />
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => {
                      const mine = m.senderId === user.id
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[75%] rounded-2xl px-3 py-2", mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}>
                            {!mine && <div className="text-[10px] font-bold mb-0.5 opacity-80">{m.sender.displayName}</div>}
                            <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                            <div className={cn("text-[10px] mt-0.5", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="border-t p-3 flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder={t("chat.typeMessage")}
                  disabled={sending}
                />
                <Button onClick={send} disabled={!draft.trim() || sending}>
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

function NewConversationDialog({ employees, onClose, onCreated }: { employees: EmployeeInfo[]; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useApp((s) => s.t)
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 9 ? [...prev, id] : prev)
  }

  const submit = async () => {
    if (selected.length === 0) return
    setSaving(true)
    try {
      const r = await api.createConversation({ participantIds: selected, name: name || undefined, isGroup: selected.length > 1 })
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
        <div className="max-h-72 overflow-y-auto scroll-thin space-y-1">
          {employees.map((e) => (
            <label key={e.id} className={cn("flex items-center gap-3 rounded-md border p-2 cursor-pointer hover:bg-accent/50", selected.includes(e.id) && "border-primary bg-primary/5")}>
              <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4" />
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">{e.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{e.displayName}</div>
                <div className="text-xs text-muted-foreground truncate">{e.role.name}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={saving || selected.length === 0}>{t("common.create")}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
