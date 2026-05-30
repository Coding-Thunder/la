"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { doc, deleteDoc, onSnapshot } from "firebase/firestore"
import { ref, deleteObject } from "firebase/storage"
import { ArrowLeft, Loader2, AlertCircle, RotateCw, Trash2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { db, storage } from "@/lib/firebase/client"
import { AnalysisReport } from "@/components/analysis-report"
import { Button } from "@/components/ui/button"
import type { AnalysisRecord } from "@/lib/types"
import { toast } from "sonner"

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const router = useRouter()

  const [record, setRecord] = useState<AnalysisRecord | null>(null)
  const [missing, setMissing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const startRef = useRef(Date.now())

  // Live updates from Firestore.
  useEffect(() => {
    if (!id) return
    return onSnapshot(
      doc(db, "analyses", id),
      (snap) => {
        if (!snap.exists()) {
          setMissing(true)
          return
        }
        setRecord(snap.data() as AnalysisRecord)
      },
      () => setMissing(true),
    )
  }, [id])

  // Elapsed timer while processing (drives the "taking a while" hint).
  useEffect(() => {
    if (record?.status !== "processing") return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [record?.status])

  async function retry() {
    if (!id) return
    setRetrying(true)
    startRef.current = Date.now()
    setElapsed(0)
    try {
      const token = await getToken()
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ analysisId: id }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error("Couldn't start analysis. Please try again.")
    } finally {
      setRetrying(false)
    }
  }

  async function handleDelete() {
    if (!record) return
    if (!confirm("Delete this document and its analysis? This cannot be undone.")) return
    try {
      if (record.storagePath) {
        await deleteObject(ref(storage, record.storagePath)).catch(() => {})
      }
      await deleteDoc(doc(db, "analyses", record.id))
      await deleteDoc(doc(db, "documents", record.documentId)).catch(() => {})
      toast.success("Deleted")
      router.push("/dashboard")
    } catch {
      toast.error("Could not delete. Please try again.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Documents
        </Link>
        {record && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive print:hidden"
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        )}
      </div>

      {missing ? (
        <StateCard
          icon={<AlertCircle className="h-8 w-8 text-muted-foreground/60" />}
          title="Analysis not found"
          body="It may have been deleted, or you don't have access to it."
        />
      ) : !record ? (
        <StateCard icon={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />} title="Loading…" />
      ) : record.status === "processing" ? (
        <StateCard
          icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
          title="Analyzing your document"
          body={record.fileName}
        >
          {elapsed > 75 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                This is taking longer than usual.
              </p>
              <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
                <RotateCw className="mr-1.5 h-4 w-4" /> Retry
              </Button>
            </div>
          )}
        </StateCard>
      ) : record.status === "error" ? (
        <StateCard
          icon={<AlertCircle className="h-8 w-8 text-red-500" />}
          title="Analysis failed"
          body={record.error || "Something went wrong while analyzing this document."}
        >
          <Button size="sm" variant="outline" onClick={retry} disabled={retrying} className="mt-4">
            {retrying ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="mr-1.5 h-4 w-4" />
            )}
            Try again
          </Button>
        </StateCard>
      ) : record.result ? (
        <AnalysisReport
          result={record.result}
          fileName={record.fileName}
          unverifiedQuotes={record.unverifiedQuotes}
        />
      ) : null}
    </div>
  )
}

function StateCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode
  title: string
  body?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-white px-6 py-16 text-center">
      {icon}
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {children}
    </div>
  )
}
