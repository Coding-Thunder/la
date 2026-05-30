import "server-only"

// Firebase Admin SDK — server only. Verifies ID tokens, reads Storage, writes
// authoritative Firestore results (bypasses security rules by design).
// Initialized lazily so importing this module never triggers side effects.
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

function getAdminApp(): App {
  if (getApps().length) return getApp()

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set")

  let serviceAccount: Record<string, string>
  try {
    serviceAccount = JSON.parse(raw)
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON")
  }

  // Restore newlines in the private key when stored as a single env line.
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n")
  }

  return initializeApp({
    credential: cert(serviceAccount as never),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function adminBucket() {
  return getStorage(getAdminApp()).bucket()
}
