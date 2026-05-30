import { Info } from "lucide-react"

/** Persistent, non-dismissable reminder. This is a review aid, not legal advice. */
export function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        LexReview is an AI-assisted review aid for qualified lawyers. It can make
        mistakes and may miss issues. It is <strong>not legal advice</strong> —
        always verify against the source document before relying on anything here.
      </p>
    </div>
  )
}
