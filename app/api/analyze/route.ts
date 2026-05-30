import { type NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { FieldValue } from "firebase-admin/firestore"
import { adminAuth, adminDb, adminBucket } from "@/lib/firebase/admin"
import { analyzeDocument, countUnverifiedQuotes } from "@/lib/gemini"
import type { AnalysisRecord, DocumentRecord } from "@/lib/types"

// firebase-admin + mammoth need the Node runtime. Allow up to 60s for Gemini.
export const runtime = "nodejs"
export const maxDuration = 60

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export async function POST(req: NextRequest) {
  // 1. Authenticate the caller via Firebase ID token.
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let uid: string
  let email: string | undefined
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    uid = decoded.uid
    email = decoded.email
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // 2. Optional allowlist (cost / abuse guard).
  const allow = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allow.length > 0 && (!email || !allow.includes(email.toLowerCase()))) {
    return NextResponse.json({ error: "Access not enabled for this account." }, { status: 403 })
  }

  // 3. Parse body.
  let analysisId: string
  try {
    const body = await req.json()
    analysisId = body.analysisId
    if (!analysisId || typeof analysisId !== "string") throw new Error()
  } catch {
    return NextResponse.json({ error: "analysisId is required" }, { status: 400 })
  }

  const db = adminDb()
  const analysisRef = db.collection("analyses").doc(analysisId)
  const analysisSnap = await analysisRef.get()

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
  }
  const analysis = analysisSnap.data() as AnalysisRecord
  if (analysis.uid !== uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // Idempotent: already done.
  if (analysis.status === "complete" && analysis.result) {
    return NextResponse.json({ ok: true, alreadyComplete: true })
  }

  // 4. Daily cap (in-memory count; fine at MVP scale).
  const dailyLimit = Number(process.env.DAILY_ANALYSIS_LIMIT || 0)
  if (dailyLimit > 0) {
    const dayStart = Date.now() - 24 * 60 * 60 * 1000
    const recent = await db.collection("analyses").where("uid", "==", uid).get()
    const usedToday = recent.docs.filter(
      (d) => (d.data().createdAt ?? 0) > dayStart && d.id !== analysisId,
    ).length
    if (usedToday >= dailyLimit) {
      await analysisRef.update({
        status: "error",
        error: "Daily analysis limit reached. Try again tomorrow.",
        completedAt: Date.now(),
      })
      return NextResponse.json({ error: "Daily limit reached" }, { status: 429 })
    }
  }

  // 5. Load the document metadata + bytes from Storage.
  try {
    const docSnap = await db.collection("documents").doc(analysis.documentId).get()
    if (!docSnap.exists) throw new Error("Source document metadata missing")
    const document = docSnap.data() as DocumentRecord

    const [buffer] = await adminBucket().file(document.storagePath).download()

    // 6. PDFs go to Gemini natively (handles scanned/image PDFs via OCR).
    //    DOCX is converted to text first (Gemini doesn't ingest DOCX directly).
    let result, model, unverifiedQuotes: number | undefined

    if (document.mimeType === DOCX) {
      const { value: text } = await mammoth.extractRawText({ buffer })
      if (!text || text.trim().length < 20) {
        throw new Error("Could not read text from this document.")
      }
      const out = await analyzeDocument({ kind: "text", text })
      result = out.result
      model = out.model
      unverifiedQuotes = countUnverifiedQuotes(result, text)
    } else {
      // Treat everything else as PDF.
      const out = await analyzeDocument({ kind: "pdf", base64: buffer.toString("base64") })
      result = out.result
      model = out.model
    }

    // 7. Persist the authoritative result.
    await analysisRef.update({
      status: "complete",
      result,
      model,
      unverifiedQuotes: unverifiedQuotes ?? FieldValue.delete(),
      completedAt: Date.now(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analysis failed. Please try again."
    console.error("analyze error:", message)
    await analysisRef
      .update({ status: "error", error: message, completedAt: Date.now() })
      .catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
