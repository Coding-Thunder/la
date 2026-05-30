"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, uploadBytesResumable } from "firebase/storage"
import { doc, setDoc } from "firebase/firestore"
import { UploadCloud, FileText, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { db, storage } from "@/lib/firebase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ACCEPTED: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
}
const MAX_BYTES = 15 * 1024 * 1024 // 15MB

export function UploadDropzone() {
  const { user, getToken } = useAuth()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFile = useCallback(
    async (file: File) => {
      if (!user) return
      if (!ACCEPTED[file.type]) {
        toast.error("Unsupported file. Upload a PDF or DOCX.")
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error("File too large. Maximum size is 15MB.")
        return
      }

      setBusy(true)
      setProgress(0)
      const id = crypto.randomUUID()
      const safeName = file.name.replace(/[^\w.\-]+/g, "_")
      const storagePath = `users/${user.uid}/${id}/${safeName}`

      try {
        // 1. Upload the original file straight to Storage (with progress).
        const task = uploadBytesResumable(ref(storage, storagePath), file, {
          contentType: file.type,
        })
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            () => resolve(),
          )
        })

        // 2. Write the document + analysis shell so the report page can render
        //    a live "processing" state immediately.
        const now = Date.now()
        await setDoc(doc(db, "documents", id), {
          id,
          uid: user.uid,
          fileName: file.name,
          storagePath,
          mimeType: file.type,
          sizeBytes: file.size,
          createdAt: now,
        })
        await setDoc(doc(db, "analyses", id), {
          id,
          uid: user.uid,
          documentId: id,
          fileName: file.name,
          storagePath,
          status: "processing",
          createdAt: now,
        })

        // 3. Navigate to the live report, then kick off analysis in the
        //    background. The in-flight request survives the client navigation;
        //    the report page renders updates from Firestore.
        router.push(`/analysis/${id}`)

        const token = await getToken()
        void fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ analysisId: id }),
        }).catch(() => {
          /* report page surfaces failures + offers retry */
        })
      } catch (err) {
        console.error(err)
        toast.error("Upload failed. Please try again.")
        setBusy(false)
        setProgress(0)
      }
    },
    [user, getToken, router],
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click()
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 text-center transition-colors",
        dragging && "border-primary bg-accent/5",
        busy && "pointer-events-none opacity-80",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ""
        }}
      />

      {busy ? (
        <>
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">
            {progress < 100 ? `Uploading… ${progress}%` : "Starting analysis…"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">This usually takes under a minute.</p>
        </>
      ) : (
        <>
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <UploadCloud className="h-6 w-6 text-accent" />
          </span>
          <p className="text-sm font-medium">
            Drop a document here, or <span className="text-accent underline">browse</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            PDF or DOCX · up to 15MB · contracts, NDAs, notices, agreements
          </p>
        </>
      )}
    </div>
  )
}
