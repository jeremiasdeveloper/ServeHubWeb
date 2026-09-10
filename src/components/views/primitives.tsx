"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  RECEIVED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  PREPARING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  DELIVERED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  COMPLETED: "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  AVAILABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  OCCUPIED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  RESERVED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  NEEDS_CLEANING: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  OPEN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CLOSED: "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
  PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  HALF_DAY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  LEAVE: "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  NORMAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

export function StatusBadge({ status, className, label }: { status: string; className?: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"
  return (
    <Badge variant="secondary" className={cn("font-medium", style, className)}>
      {label ?? status}
    </Badge>
  )
}

export function PriorityBadge({ priority, label }: { priority: string; label?: string }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.NORMAL
  return (
    <Badge variant="secondary" className={cn("font-medium", style)}>
      {label ?? priority}
    </Badge>
  )
}
