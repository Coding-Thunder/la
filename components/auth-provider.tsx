"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { auth, db, googleProvider } from "@/lib/firebase/client"

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        // Upsert a minimal profile (best-effort; never blocks the UI).
        try {
          await setDoc(
            doc(db, "users", u.uid),
            {
              uid: u.uid,
              email: u.email ?? "",
              name: u.displayName ?? "",
              photoURL: u.photoURL ?? "",
              lastSeenAt: serverTimestamp(),
            },
            { merge: true },
          )
        } catch {
          /* profile write is non-critical */
        }
      }
    })
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      // Popups get blocked on some browsers — fall back to a full redirect.
      const code = (err as { code?: string })?.code
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, new GoogleAuthProvider())
        return
      }
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const getToken = useCallback(async () => {
    return auth.currentUser ? auth.currentUser.getIdToken() : null
  }, [])

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, logout, getToken }),
    [user, loading, signInWithGoogle, logout, getToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
