"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { FileText, Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { db } from "@/lib/firebase/client"
import { UploadDropzone } from "@/components/upload-dropzone"
import type { AnalysisRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function StatusPill({ status }: { status: AnalysisRecord["status"] }) {
  if (status === "complete")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
      </span>
    )
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="h-3.5 w-3.5" /> Failed
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing
    </span>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    // Single-field filter (no composite index needed); sort client-side.
    const q = query(collection(db, "analyses"), where("uid", "==", user.uid))
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as AnalysisRecord)
        rows.sort((a, b) => b.createdAt - a.createdAt)
        setAnalyses(rows)
        setLoaded(true)
      },
      () => setLoaded(true),
    )
  }, [user])

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400 * 1000
    return {
      total: analyses.length,
      week: analyses.filter((a) => a.createdAt > weekAgo).length,
      processing: analyses.filter((a) => a.status === "processing").length,
    }
  }, [analyses])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a document to get a structured review in under a minute.
        </p>
      </div>

      <UploadDropzone />

      {analyses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total reviews" value={stats.total} />
          <Stat label="This week" value={stats.week} />
          <Stat label="In progress" value={stats.processing} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent</h2>

        {!loaded ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No documents yet. Upload your first one above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {analyses.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/analysis/${a.id}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.fileName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.result?.document_type ?? "Document"} · {timeAgo(a.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={a.status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
