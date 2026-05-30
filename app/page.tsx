"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Scale, FileSearch, ShieldCheck, Clock, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function LandingPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard")
  }, [loading, user, router])

  async function handleSignIn() {
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch {
      toast.error("Sign-in failed. Please try again.")
      setSigningIn(false)
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Scale className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">LexReview</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Review legal documents in a fraction of the time.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Upload a contract, NDA, or notice. Get a structured first-pass review —
            parties, obligations, risks, red flags, and likely-missing clauses —
            each tied back to the exact wording in your document.
          </p>

          <div className="mt-8">
            <Button size="lg" onClick={handleSignIn} disabled={signingIn} className="gap-2">
              {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleGlyph />}
              Continue with Google
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              For practicing lawyers. A review aid — not legal advice.
            </p>
          </div>

          <ul className="mt-10 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-accent" /> A first-pass review in under a minute
            </li>
            <li className="flex items-center gap-2.5">
              <FileSearch className="h-4 w-4 text-accent" /> Every finding grounded in a verbatim quote
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-accent" /> Your documents stay private to your account
            </li>
          </ul>
        </div>

        <div className="hidden rounded-2xl border border-border bg-card p-6 shadow-sm md:block">
          <div className="space-y-3">
            <div className="h-2.5 w-24 rounded bg-muted" />
            <div className="h-6 w-48 rounded bg-slate-200" />
            <div className="mt-4 space-y-2">
              {["Parties", "Risk Analysis", "Red Flags", "Missing Clauses", "Review Notes"].map(
                (label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium text-foreground/80">{label}</span>
                    <span className="h-1.5 w-10 rounded bg-muted" />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 4.1 29.3 2 24 2 12 2 2 12 2 24s10 22 22 22 22-10 22-22c0-1.5-.2-2.6-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 4.1 29.3 2 24 2 16.3 2 9.7 6.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 46c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 37 26.7 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 41.6 16.2 46 24 46z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C41.4 36.3 46 30.8 46 24c0-1.5-.2-2.6-.4-3.5z"
      />
    </svg>
  )
}
