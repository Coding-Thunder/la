// Shared types for documents + analyses.
// Kept intentionally small — three concepts only.

export type AnalysisStatus = "processing" | "complete" | "error"

export type Severity = "high" | "medium" | "low"
export type Confidence = "high" | "medium" | "low"

export interface Party {
  name: string
  role: string
}

export interface Obligation {
  party: string
  obligation: string
  /** Verbatim text from the document supporting this. Empty if not found. */
  clause_quote: string
}

export interface Risk {
  title: string
  severity: Severity
  clause_quote: string
  why_it_matters: string
}

export interface MissingClause {
  clause: string
  why_it_matters: string
}

export interface RedFlag {
  flag: string
  clause_quote: string
}

/** The structured payload Gemini returns and we render in the report. */
export interface AnalysisResult {
  document_type: string
  confidence: Confidence
  summary: string
  parties: Party[]
  obligations: Obligation[]
  risks: Risk[]
  missing_clauses: MissingClause[]
  red_flags: RedFlag[]
  review_notes: string[]
}

/** Firestore: documents/{id} */
export interface DocumentRecord {
  id: string
  uid: string
  fileName: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  createdAt: number
}

/** Firestore: analyses/{id} (same id as its document) */
export interface AnalysisRecord {
  id: string
  uid: string
  documentId: string
  fileName: string
  storagePath?: string
  status: AnalysisStatus
  model?: string
  result?: AnalysisResult
  error?: string
  /** verbatim quotes from the model that we could NOT find in the source text */
  unverifiedQuotes?: number
  createdAt: number
  completedAt?: number
}
