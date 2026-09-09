"use client"

import { useApp } from "@/lib/store"
import { Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Wraps children. When mobile preview is active (developer mode), constrains the
// content area to a 9:16 phone-sized frame centered on desktop.
//
// The inner area is a CSS container (@container) so views using container
// query variants (@md:...) render their true MOBILE layout inside the frame
// — viewport media queries alone would wrongly apply the desktop layout.
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
        className="relative h-[844px] max-h-[80vh] w-[390px] shrink-0 overflow-hidden rounded-[2rem] border-8 border-slate-800 bg-background shadow-2xl"
      >
        <div className="absolute inset-x-0 top-0 z-10 flex h-6 items-center justify-center bg-slate-800">
          <div className="h-1.5 w-16 rounded-full bg-slate-600" />
        </div>
        {/* Bounded inner area: exactly frame height minus the notch strip.
            Views can fill it with h-full / dvh-based calc heights. */}
        <div className="@container absolute inset-x-0 bottom-0 top-6 overflow-y-auto scroll-thin">
          {children}
        </div>
      </div>
    </div>
  )
}
