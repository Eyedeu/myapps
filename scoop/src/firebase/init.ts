import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

function hashConfig(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `scoop_${Math.abs(h)}`
}

export type FirestoreFromJsonResult = {
  db: Firestore | null
  /** Set when db is null so the UI can show a concrete reason (invalid JSON, duplicate-app, etc.). */
  error: string | null
}

/**
 * Returns Firestore for the given web config JSON.
 * Reuses an existing FirebaseApp when the config hash matches so we never hit
 * duplicate-app errors or get stuck returning null after a failed re-init.
 */
export function getFirestoreFromJson(json: string): FirestoreFromJsonResult {
  const trimmed = json.trim()
  if (!trimmed) return { db: null, error: null }
  try {
    const cfg = JSON.parse(trimmed) as FirebaseOptions
    if (!cfg.apiKey || !cfg.projectId) {
      return { db: null, error: 'Firebase JSON must include apiKey and projectId.' }
    }
    const name = hashConfig(trimmed)
    const existing = getApps().find((a) => a.name === name)
    const app = existing ?? initializeApp(cfg, name)
    return { db: getFirestore(app), error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[Scoop] Firebase init failed:', e)
    return { db: null, error: msg }
  }
}
