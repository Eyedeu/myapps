import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

function hashConfig(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `scoop_${Math.abs(h)}`
}

/**
 * Returns Firestore for the given web config JSON.
 * Reuses an existing FirebaseApp when the config hash matches so we never hit
 * duplicate-app errors or get stuck returning null after a failed re-init.
 */
export function getFirestoreFromJson(json: string): Firestore | null {
  const trimmed = json.trim()
  if (!trimmed) return null
  try {
    const cfg = JSON.parse(trimmed) as FirebaseOptions
    if (!cfg.apiKey || !cfg.projectId) return null
    const name = hashConfig(trimmed)
    const existing = getApps().find((a) => a.name === name)
    const app = existing ?? initializeApp(cfg, name)
    return getFirestore(app)
  } catch {
    return null
  }
}
