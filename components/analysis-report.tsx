"use client"

import {
  AlertTriangle,
  FileSearch,
  Flag,
  ListChecks,
  Printer,
  ShieldAlert,
  Users,
  Quote,
} from "lucide-react"
import type { AnalysisResult, Severity } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        SEVERITY_STYLES[severity],
      )}
    >
      {severity}
    </span>
  )
}

function Clause({ text }: { text: string }) {
  if (!text?.trim()) return null
  return (
    <blockquote className="mt-2 flex gap-2 rounded-md border-l-2 border-border bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
      <span>{text}</span>
    </blockquote>
  )
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Users
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-accent" />
        {title}
        {typeof count === "number" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  )
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
}

export function AnalysisReport({
  result,
  fileName,
  unverifiedQuotes,
}: {
  result: AnalysisResult
  fileName: string
  unverifiedQuotes?: number
}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{fileName}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{result.document_type}</h1>
            <span
              className={cn(
                "mt-2 inline-block rounded-full border px-2 py-0.5 text-xs",
                result.confidence === "high" && "border-green-200 bg-green-50 text-green-700",
                result.confidence === "medium" && "border-amber-200 bg-amber-50 text-amber-700",
                result.confidence === "low" && "border-slate-200 bg-slate-100 text-slate-600",
              )}
            >
              {CONFIDENCE_LABEL[result.confidence] ?? "Confidence unknown"}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="mr-2 h-4 w-4" />
            Export / Print
          </Button>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {result.summary}
        </p>
        {!!unverifiedQuotes && unverifiedQuotes > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {unverifiedQuotes} quoted passage{unverifiedQuotes > 1 ? "s" : ""} could not be matched
            verbatim to the source text — verify these manually.
          </p>
        )}
      </div>

      {/* Parties */}
      {result.parties.length > 0 && (
        <Section icon={Users} title="Parties" count={result.parties.length}>
          <ul className="divide-y divide-border">
            {result.parties.map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.role}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Risks */}
      {result.risks.length > 0 && (
        <Section icon={AlertTriangle} title="Risk Analysis" count={result.risks.length}>
          <ul className="space-y-4">
            {result.risks.map((r, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <SeverityBadge severity={r.severity} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.why_it_matters}</p>
                <Clause text={r.clause_quote} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Red flags */}
      {result.red_flags.length > 0 && (
        <Section icon={Flag} title="Red Flags" count={result.red_flags.length}>
          <ul className="space-y-3">
            {result.red_flags.map((f, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{f.flag}</p>
                <Clause text={f.clause_quote} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Obligations */}
      {result.obligations.length > 0 && (
        <Section icon={ListChecks} title="Key Obligations" count={result.obligations.length}>
          <ul className="space-y-4">
            {result.obligations.map((o, i) => (
              <li key={i}>
                <p className="text-sm">
                  <span className="font-medium">{o.party}</span> {o.obligation}
                </p>
                <Clause text={o.clause_quote} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Missing clauses */}
      {result.missing_clauses.length > 0 && (
        <Section icon={ShieldAlert} title="Potentially Missing Clauses" count={result.missing_clauses.length}>
          <ul className="space-y-3">
            {result.missing_clauses.map((m, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{m.clause}</p>
                <p className="text-sm text-muted-foreground">{m.why_it_matters}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Review notes */}
      {result.review_notes.length > 0 && (
        <Section icon={FileSearch} title="Suggested Review Notes" count={result.review_notes.length}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
            {result.review_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
