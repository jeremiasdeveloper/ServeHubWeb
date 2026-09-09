"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/store"
import { SplashScreen } from "@/components/splash-screen"
import { BrandingInjector } from "@/components/branding-injector"
import { LoginScreen } from "@/components/login-screen"
import { ResponsiveShell } from "@/components/responsive-shell"
import { DashboardView } from "@/components/views/dashboard-view"
import { OrdersView } from "@/components/views/orders-view"
import { TablesView } from "@/components/views/tables-view"
import { EmployeesView } from "@/components/views/employees-view"
import { RolesView } from "@/components/views/roles-view"
import { ComplaintsView } from "@/components/views/complaints-view"
import { CustomerServiceView } from "@/components/views/customer-service-view"
import { ChatView } from "@/components/views/chat-view"
import { AttendanceView } from "@/components/views/attendance-view"
import { NotificationsView } from "@/components/views/notifications-view"
import { SettingsView } from "@/components/views/settings-view"
import { DeveloperPanel } from "@/components/views/developer-panel"
import { MobilePreviewFrame } from "@/components/views/mobile-preview-frame"
import { Loader2 } from "lucide-react"

export default function Page() {
  const booted = useApp((s) => s.booted)
  const boot = useApp((s) => s.boot)
  const user = useApp((s) => s.user)
  const authLoading = useApp((s) => s.authLoading)
  const refreshMe = useApp((s) => s.refreshMe)
  const view = useApp((s) => s.view)
  const devMode = useApp((s) => s.devMode)
  const mobilePreview = useApp((s) => s.mobilePreview)

  const [showSplash, setShowSplash] = useState(true)

  // boot config + restore session
  useEffect(() => {
    boot()
    refreshMe()
  }, [boot, refreshMe])

  // Splash shows at least once per cold load
  useEffect(() => {
    if (booted) {
      const id = setTimeout(() => setShowSplash(false), 2200)
      return () => clearTimeout(id)
    }
  }, [booted])

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />
      case "orders": return <OrdersView />
      case "tables": return <TablesView />
      case "employees": return <EmployeesView />
      case "roles": return <RolesView />
      case "complaints": return <ComplaintsView />
      case "customerService": return <CustomerServiceView />
      case "chat": return <ChatView />
      case "attendance": return <AttendanceView />
      case "notifications": return <NotificationsView />
      case "settings": return <SettingsView />
      default: return <DashboardView />
    }
  }

  // Splash is always shown first
  if (showSplash && !booted) {
    return <SplashScreen onDone={() => setShowSplash(false)} />
  }

  return (
    <>
      <BrandingInjector />
      {showSplash && (
        <SplashScreen onDone={() => setShowSplash(false)} />
      )}

      {!booted ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : authLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !user ? (
        <LoginScreen />
      ) : (
        <ResponsiveShell>
          <MobilePreviewFrame active={mobilePreview}>
            {renderView()}
          </MobilePreviewFrame>
          {devMode && <DeveloperPanel />}
        </ResponsiveShell>
      )}
    </>
  )
}
