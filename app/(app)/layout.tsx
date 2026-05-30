"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { AppHeader } from "@/components/app-header"
import { DisclaimerBanner } from "@/components/disclaimer-banner"

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace("/")
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <AppHeader />
      <DisclaimerBanner />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
