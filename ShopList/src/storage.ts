import { DEFAULT_FIREBASE_JSON } from './firebase/defaultConfig'

const KEY = 'shoplist_firebase_json_v1'

export function loadFirebaseJson(): string {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved != null && saved.trim() !== '') return saved
  } catch {
    /* ignore */
  }
  return DEFAULT_FIREBASE_JSON
}

export function saveFirebaseJson(json: string): void {
  try {
    localStorage.setItem(KEY, json)
  } catch {
    /* ignore */
  }
}
