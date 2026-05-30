# LexReview

**Review legal documents in a fraction of the time.** A lawyer uploads a
contract / NDA / notice / agreement (PDF or DOCX) and gets a structured
first-pass review — document type, plain-language summary, parties, key
obligations, risk analysis, likely-missing clauses, red flags, and review
notes — each finding tied back to a verbatim quote from the document.

It is a **review aid for qualified lawyers, not legal advice.** The model is
constrained to describe the document in front of it; it does not cite laws,
invent statutes, or recommend legal action.

---

## Stack

- **Next.js 14** (App Router) — UI + one API route
- **Firebase Auth** — Google sign-in
- **Firestore** — `users`, `documents`, `analyses`
- **Firebase Storage** — uploaded originals
- **Gemini** (`@google/genai`) — analysis with structured JSON output
- **mammoth** — DOCX → text (PDFs go to Gemini natively)

No vector DB, no LangChain, no queue, no extra infrastructure.

---

## How it works

```
Browser                         Firebase                  Next API (/api/analyze)        Gemini
  │ 1. Google sign-in ────────▶ Auth
  │ 2. upload PDF/DOCX ───────▶ Storage  users/{uid}/{id}/file
  │ 3. create shell docs ─────▶ Firestore documents/{id}, analyses/{id} (processing)
  │ 4. navigate to /analysis/{id}  (subscribes to the doc, shows "Analyzing…")
  │ 5. POST {analysisId} ──────────────────────────────▶ verify ID token (Admin)
  │                                                       download file from Storage
  │                                                       PDF → bytes │ DOCX → text ──▶ generateContent
  │                                                       write result back ◀──────────  structured JSON
  │ 6. Firestore snapshot updates → report renders
```

**Why PDFs skip text extraction:** many documents lawyers receive are scanned
(image-only) PDFs with no text layer. Gemini is multimodal and OCRs the PDF
directly, so scanned contracts work. DOCX has no image fallback, so it is
converted to text with `mammoth`.

**Trust / anti-hallucination:** the response schema forces every risk,
obligation, and red flag to carry a `clause_quote` copied verbatim from the
document. For DOCX (where we have the source text) the server counts any quote
it can't match back to the source and surfaces that warning in the report.

---

## Data model (Firestore)

```
users/{uid}          { uid, email, name, photoURL, lastSeenAt }
documents/{id}       { uid, fileName, storagePath, mimeType, sizeBytes, createdAt }
analyses/{id}        { uid, documentId, fileName, storagePath, status,
                       model, result{…}, unverifiedQuotes, createdAt, completedAt }
```

`id` is shared between a document and its analysis (one analysis per upload).
Security rules (`firestore.rules`, `storage.rules`): a user can only ever read,
create, or delete their **own** records. AI results are written **only** by the
server (Admin SDK), so clients can never forge a result.

Storage layout: `users/{uid}/{analysisId}/{filename}`.

---

## Setup (≈15 minutes)

### 1. Firebase project
1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Sign-in method →** enable **Google**.
3. **Build → Firestore Database →** create (production mode).
4. **Build → Storage →** enable (requires the **Blaze** plan).
5. **Project settings → General → Your apps → Web app** → copy the config into
   the `NEXT_PUBLIC_FIREBASE_*` vars.
6. **Project settings → Service accounts → Generate new private key** → paste
   the entire JSON (single line) into `FIREBASE_SERVICE_ACCOUNT`.

### 2. Gemini key
Create a key at <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`.
Use the **paid tier** for client documents — the paid Gemini API does not train
on your data. Default model is `gemini-2.5-flash`.

### 3. Environment
```bash
cp .env.example .env.local   # then fill in every value
```
Set `ALLOWED_EMAILS` to your pilot lawyers' Google addresses so a leaked link
can't run up your Gemini bill.

### 4. Deploy security rules
```bash
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,storage:rules
```

### 5. Run
```bash
npm install
npm run dev          # http://localhost:3000
```

For local dev, add `localhost` under **Authentication → Settings → Authorized
domains** (it's there by default).

---

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Add every variable from `.env.example` in **Project → Settings →
   Environment Variables** (including `FIREBASE_SERVICE_ACCOUNT` as one line).
3. Add your Vercel domain under Firebase **Auth → Authorized domains**.
4. `/api/analyze` declares `maxDuration = 60`. On Vercel this needs the **Pro**
   plan for the full 60s; on Hobby it's capped at ~10s, which is enough for
   short documents but may time out on long PDFs.

---

## What's intentionally **not** here

Marketplace, client portal, payments, analytics, CRM, research platform,
multi-agent anything, subscriptions, admin panel, roles. This is one workflow:
upload → review → reopen. Keep it that way until 3–4 lawyers use it weekly.

## Limits & honest caveats

- Upload cap 15MB; very long PDFs may approach the 60s timeout.
- DOCX only for Word (not legacy `.doc`); scanned PDFs rely on Gemini OCR.
- The daily per-user cap (`DAILY_ANALYSIS_LIMIT`) counts in memory — fine at
  pilot scale, not a billing-grade meter.
- This is a **review aid, not legal advice.** Every screen says so.
