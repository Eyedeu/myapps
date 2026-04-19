import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { NewListSheet } from '../components/NewListSheet.tsx'
import { defaultListTitle } from '../listTitle'
import { navigateTo } from '../route'

type Props = {
  db: Firestore
}

type ListRow = {
  id: string
  title: string
  createdAt: Date | null
  pendingCount: number | null
  totalCount: number | null
}

function parseListDoc(id: string, data: Record<string, unknown>): ListRow {
  const rawTitle = data.title
  const title =
    typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Liste'
  let createdAt: Date | null = null
  if (data.createdAt instanceof Timestamp) {
    createdAt = data.createdAt.toDate()
  }
  const pendingCount = typeof data.pendingCount === 'number' ? data.pendingCount : null
  const totalCount = typeof data.totalCount === 'number' ? data.totalCount : null
  return { id, title, createdAt, pendingCount, totalCount }
}

export function Home({ db }: Props) {
  const [lists, setLists] = useState<ListRow[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [sheetSession, setSheetSession] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [snapErr, setSnapErr] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'shopLists'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSnapErr(null)
        setLists(snap.docs.map((d) => parseListDoc(d.id, d.data() as Record<string, unknown>)))
      },
      (e) => setSnapErr(e.message),
    )
    return () => unsub()
  }, [db])

  async function handleCreateList(name: string) {
    setErr(null)
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      const title = name.trim() || defaultListTitle()
      await setDoc(doc(db, 'shopLists', id), {
        createdAt: serverTimestamp(),
        title,
        pendingCount: 0,
        totalCount: 0,
      })
      setCreateOpen(false)
      navigateTo({ name: 'list', listId: id })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function formatWhen(d: Date | null): string {
    if (!d) return ''
    return d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
  }

  function progress(row: ListRow): string {
    if (row.totalCount == null || row.pendingCount == null) return ''
    if (row.totalCount === 0) return 'Henüz ürün yok'
    const done = row.totalCount - row.pendingCount
    return `${done}/${row.totalCount} alındı`
  }

  return (
    <div className="page home home-with-fab">
      <header className="hero hero-compact">
        <h1>ShopList</h1>
        <p className="subtitle">
          Ortak alışveriş listeleriniz burada. İkiniz de aynı Firebase projesine bağlı olduğunuz için
          listeler anında güncellenir.
        </p>
      </header>

      <section className="lists-section lists-section-first">
        <h2 className="lists-heading">Listeleriniz</h2>
        {snapErr && <p className="error">{snapErr}</p>}
        {!snapErr && lists.length === 0 && (
          <p className="muted empty-lists">
            Henüz liste yok. Sağ alttaki <span className="mono">+</span> düğmesiyle yeni liste oluşturun.
          </p>
        )}
        <ul className="list-cards">
          {lists.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="list-card"
                onClick={() => navigateTo({ name: 'list', listId: row.id })}
              >
                <span className="list-card-title">{row.title}</span>
                {row.createdAt && <span className="list-card-meta">{formatWhen(row.createdAt)}</span>}
                {progress(row) && <span className="list-card-progress">{progress(row)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {err && !createOpen && <p className="error">{err}</p>}

      <footer className="home-foot">
        <p className="muted small">
          Telefonda uygulama gibi kullanmak için tarayıcı menüsünden “Ana ekrana ekle” seçeneğini
          kullanabilirsiniz.
        </p>
      </footer>

      <button
        type="button"
        className="fab"
        aria-label="Yeni liste oluştur"
        onClick={() => {
          setErr(null)
          setSheetSession((s) => s + 1)
          setCreateOpen(true)
        }}
      >
        <span className="fab-icon" aria-hidden>
          +
        </span>
      </button>

      <NewListSheet
        key={sheetSession}
        open={createOpen}
        busy={busy}
        error={err}
        onClose={() => {
          if (!busy) {
            setCreateOpen(false)
            setErr(null)
          }
        }}
        onCreate={handleCreateList}
      />
    </div>
  )
}
