import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

let lastJson = ''
let db: Firestore | null = null

function hashConfig(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `scoop_${Math.abs(h)}`
}

export function getFirestoreFromJson(json: string): Firestore | null {
  const trimmed = json.trim()
  if (!trimmed) return null
  try {
    if (trimmed === lastJson && db) return db
    const cfg = JSON.parse(trimmed) as FirebaseOptions
    if (!cfg.apiKey || !cfg.projectId) return null
    lastJson = trimmed
    const firebaseApp = initializeApp(cfg, hashConfig(trimmed))
    db = getFirestore(firebaseApp)
    return db
  } catch {
    return null
  }
}
