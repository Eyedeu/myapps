const KEY = 'shoplist_firebase_json_v1'

export function loadFirebaseJson(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveFirebaseJson(json: string): void {
  try {
    localStorage.setItem(KEY, json)
  } catch {
    /* ignore */
  }
}
