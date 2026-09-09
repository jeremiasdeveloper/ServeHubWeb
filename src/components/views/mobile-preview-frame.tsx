"use client"

import { useApp } from "@/lib/store"
import { Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Wraps children. When mobile preview is active (developer mode), constrains the
// content area to a 9:16 phone-sized frame centered on desktop.
export function MobilePreviewFrame({ active, children }: { active: boolean; children: React.ReactNode }) {
  const toggle = useApp((s) => s.toggleMobilePreview)
  const t = useApp((s) => s.t)

  if (!active) return <>{children}</>

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs">
        <Smartphone className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{t("dev.mobilePreview")}</span>
        <span className="text-muted-foreground">· 390 × 844</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={toggle}><X className="h-3 w-3" /></Button>
      </div>
      <div
        className="relative w-[390px] h-[844px] max-h-[80vh] rounded-[2rem] border-8 border-slate-800 bg-background overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 flex items-center justify-center">
          <div className="h-1.5 w-16 rounded-full bg-slate-600" />
        </div>
        <div className="h-full pt-6 overflow-y-auto scroll-thin">
          {children}
        </div>
      </div>
    </div>
  )
}
