import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFirestoreFromJson } from './firebase/init'
import { FirebaseSetupModal } from './components/FirebaseSetupModal.tsx'
import { Home } from './pages/Home.tsx'
import { ListView } from './pages/ListView.tsx'
import { readRoute, type Route } from './route.ts'
import { loadFirebaseJson, saveFirebaseJson } from './storage.ts'

export default function App() {
  const [firebaseJson, setFirebaseJson] = useState(loadFirebaseJson)
  const [route, setRoute] = useState<Route>(() => readRoute())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const firestore = useMemo(() => getFirestoreFromJson(firebaseJson), [firebaseJson])
  const db = firestore.db
  const initError = firestore.error
  const hasValidDb = Boolean(db)

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const blockingFirebase = !hasValidDb
  const showFirebaseModal = blockingFirebase || settingsOpen

  const onSaveFirebase = useCallback((json: string) => {
    saveFirebaseJson(json)
    setFirebaseJson(json)
    setSettingsOpen(false)
  }, [])

  return (
    <>
      {hasValidDb && db && (
        <>
          <div className="top-bar">
            <button type="button" className="btn ghost small" onClick={() => setSettingsOpen(true)}>
              Firebase ayarı
            </button>
          </div>
          {route.name === 'home' ? <Home db={db} /> : <ListView db={db} listId={route.listId} />}
        </>
      )}
      {showFirebaseModal && (
        <FirebaseSetupModal
          initialJson={firebaseJson}
          initError={initError}
          onSave={onSaveFirebase}
          onClose={blockingFirebase ? undefined : () => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
