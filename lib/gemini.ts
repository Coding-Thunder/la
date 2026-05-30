import "server-only"

import { GoogleGenAI, Type } from "@google/genai"
import type { AnalysisResult } from "./types"

const apiKey = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"

// Lazily constructed so a missing key fails inside the request (catchable),
// not at module import time.
function getClient(): GoogleGenAI {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")
  return new GoogleGenAI({ apiKey })
}

// ---------------------------------------------------------------------------
// Prompt — the guardrails live here. The product promise is "review faster",
// not "legal advice", so the model is constrained to describe the document.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a legal document review assistant used by practicing lawyers to read documents faster. You assist a qualified lawyer; you do NOT replace one.

ABSOLUTE RULES:
1. Analyze ONLY the content of the document provided. Do not use outside knowledge of specific cases, statutes, or regulations.
2. NEVER invent or cite laws, statute numbers, case names, or section references. If the document does not name them, do not produce them.
3. NEVER give legal advice, opinions on outcomes, or recommendations to take legal action. Describe what the document says and where it is silent.
4. Do not claim certainty. When the document is ambiguous, scanned poorly, or incomplete, lower the "confidence" field and say so plainly in the summary.
5. Every "clause_quote" MUST be copied verbatim from the document — exact words, no paraphrasing. If you cannot find a supporting quote, use an empty string "" rather than fabricating one.
6. "missing_clauses" are standard provisions a lawyer would commonly expect in this document type that appear ABSENT. Frame them as items to check, never as legal requirements.
7. Write for a lawyer: precise, neutral, no marketing language, no emojis.

Return ONLY the structured JSON defined by the schema. No preamble.`

function userPrompt(extra: string): string {
  return `Review the following legal document and produce the structured analysis.

Identify the document type, summarize it in plain language, extract the parties and their key obligations, flag risks and red flags (one-sided terms, unusual clauses, liability exposure, missing protections), list standard clauses that appear to be missing, and write concise review notes a lawyer should check.

Ground every risk, obligation, and red flag in a verbatim quote from the document where one exists.${extra}`
}

// ---------------------------------------------------------------------------
// Response schema — forces valid, fully-populated JSON.
// ---------------------------------------------------------------------------
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    document_type: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
    summary: { type: Type.STRING },
    parties: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
        },
        required: ["name", "role"],
        propertyOrdering: ["name", "role"],
      },
    },
    obligations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          party: { type: Type.STRING },
          obligation: { type: Type.STRING },
          clause_quote: { type: Type.STRING },
        },
        required: ["party", "obligation", "clause_quote"],
        propertyOrdering: ["party", "obligation", "clause_quote"],
      },
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
          clause_quote: { type: Type.STRING },
          why_it_matters: { type: Type.STRING },
        },
        required: ["title", "severity", "clause_quote", "why_it_matters"],
        propertyOrdering: ["title", "severity", "clause_quote", "why_it_matters"],
      },
    },
    missing_clauses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          clause: { type: Type.STRING },
          why_it_matters: { type: Type.STRING },
        },
        required: ["clause", "why_it_matters"],
        propertyOrdering: ["clause", "why_it_matters"],
      },
    },
    red_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          flag: { type: Type.STRING },
          clause_quote: { type: Type.STRING },
        },
        required: ["flag", "clause_quote"],
        propertyOrdering: ["flag", "clause_quote"],
      },
    },
    review_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "document_type",
    "confidence",
    "summary",
    "parties",
    "obligations",
    "risks",
    "missing_clauses",
    "red_flags",
    "review_notes",
  ],
  propertyOrdering: [
    "document_type",
    "confidence",
    "summary",
    "parties",
    "obligations",
    "risks",
    "missing_clauses",
    "red_flags",
    "review_notes",
  ],
}

export type AnalyzeInput =
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string }

/** Calls Gemini and returns parsed, schema-shaped analysis. Throws on failure. */
export async function analyzeDocument(input: AnalyzeInput): Promise<{
  result: AnalysisResult
  model: string
}> {
  const ai = getClient()

  const parts: Array<Record<string, unknown>> =
    input.kind === "pdf"
      ? [
          { inlineData: { mimeType: "application/pdf", data: input.base64 } },
          { text: userPrompt("") },
        ]
      : [
          {
            text:
              userPrompt("") +
              `\n\n----- DOCUMENT TEXT -----\n${input.text}\n----- END DOCUMENT -----`,
          },
        ]

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA as never,
      temperature: 0.2,
    },
  })

  const text = response.text
  if (!text) throw new Error("Gemini returned an empty response")

  const result = parseResult(text)
  return { result, model: MODEL }
}

function parseResult(raw: string): AnalysisResult {
  // responseMimeType=json should give clean JSON, but strip fences defensively.
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(cleaned) as AnalysisResult
  } catch {
    throw new Error("Could not parse the model response as JSON")
  }
  // Defensive defaults so the UI never crashes on a missing array.
  return {
    document_type: parsed.document_type || "Unknown",
    confidence: parsed.confidence || "low",
    summary: parsed.summary || "",
    parties: parsed.parties ?? [],
    obligations: parsed.obligations ?? [],
    risks: parsed.risks ?? [],
    missing_clauses: parsed.missing_clauses ?? [],
    red_flags: parsed.red_flags ?? [],
    review_notes: parsed.review_notes ?? [],
  }
}

/**
 * Anti-hallucination check: count clause quotes that do NOT appear verbatim in
 * the source text. Only meaningful for the text/DOCX path (we have the source).
 * Whitespace is normalized so minor extraction differences don't false-positive.
 */
export function countUnverifiedQuotes(result: AnalysisResult, sourceText: string): number {
  const haystack = normalize(sourceText)
  const quotes: string[] = [
    ...result.obligations.map((o) => o.clause_quote),
    ...result.risks.map((r) => r.clause_quote),
    ...result.red_flags.map((f) => f.clause_quote),
  ].filter((q) => q && q.trim().length > 0)

  let missing = 0
  for (const q of quotes) {
    if (!haystack.includes(normalize(q))) missing++
  }
  return missing
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}
