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
  const [newListName, setNewListName] = useState('')
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

  async function createList() {
    setErr(null)
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      const title = newListName.trim() || defaultListTitle()
      await setDoc(doc(db, 'shopLists', id), {
        createdAt: serverTimestamp(),
        title,
        pendingCount: 0,
        totalCount: 0,
      })
      setNewListName('')
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
    <div className="page home">
      <header className="hero">
        <h1>ShopList</h1>
        <p className="subtitle">
          Ortak alışveriş listeleriniz burada. İkiniz de aynı Firebase projesine bağlı olduğunuz için
          listeler anında güncellenir.
        </p>
      </header>

      <section className="card new-list-card">
        <h2>Yeni liste</h2>
        <p className="muted">Market veya ev ihtiyaçları için yeni bir liste açın. Adı boş bırakırsanız otomatik bir başlık atanır; sonra listede değiştirebilirsiniz.</p>
        <form
          className="new-list-form"
          onSubmit={(e) => {
            e.preventDefault()
            void createList()
          }}
        >
          <label className="field new-list-name-field">
            <span className="field-label">Liste adı</span>
            <input
              className="field-input"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={defaultListTitle()}
              maxLength={80}
              disabled={busy}
              enterKeyHint="done"
              aria-label="Yeni liste adı"
            />
          </label>
          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? 'Oluşturuluyor…' : 'Yeni liste oluştur'}
          </button>
        </form>
      </section>

      <section className="lists-section">
        <h2 className="lists-heading">Listeleriniz</h2>
        {snapErr && <p className="error">{snapErr}</p>}
        {!snapErr && lists.length === 0 && (
          <p className="muted empty-lists">Henüz liste yok. Yukarıdan bir tane oluşturun.</p>
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

      {err && <p className="error">{err}</p>}

      <footer className="home-foot">
        <p className="muted small">
          Telefonda uygulama gibi kullanmak için tarayıcı menüsünden “Ana ekrana ekle” seçeneğini
          kullanabilirsiniz.
        </p>
      </footer>
    </div>
  )
}
