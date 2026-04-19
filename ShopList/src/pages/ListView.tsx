import { useEffect, useMemo, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { navigateTo } from '../route'
import { listShareUrl } from '../share'
import type { ListItem } from '../types'

type Props = {
  db: Firestore
  listId: string
}

export function ListView({ db, listId }: Props) {
  const [items, setItems] = useState<ListItem[]>([])
  const [newText, setNewText] = useState('')
  const [fireErr, setFireErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const itemsRef = useMemo(() => collection(db, 'shopLists', listId, 'items'), [db, listId])
  const share = useMemo(() => listShareUrl(listId), [listId])

  useEffect(() => {
    const q = query(itemsRef, orderBy('order', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFireErr(null)
        const next: ListItem[] = []
        for (const d of snap.docs) {
          const data = d.data() as { text?: unknown; done?: unknown; order?: unknown }
          next.push({
            id: d.id,
            text: typeof data.text === 'string' ? data.text : '',
            done: Boolean(data.done),
            order: typeof data.order === 'number' ? data.order : 0,
          })
        }
        setItems(next)
      },
      (e) => setFireErr(e.message),
    )
    return () => unsub()
  }, [itemsRef])

  async function addItem() {
    const text = newText.trim()
    if (!text) return
    setNewText('')
    await addDoc(itemsRef, {
      text,
      done: false,
      order: Date.now(),
      createdAt: serverTimestamp(),
    })
  }

  async function toggleDone(item: ListItem) {
    await updateDoc(doc(itemsRef, item.id), { done: !item.done })
  }

  async function removeItem(item: ListItem) {
    await deleteDoc(doc(itemsRef, item.id))
  }

  async function clearBought() {
    const bought = items.filter((i) => i.done)
    if (bought.length === 0) return
    const batch = writeBatch(db)
    for (const i of bought) {
      batch.delete(doc(itemsRef, i.id))
    }
    await batch.commit()
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Bağlantıyı kopyalayın:', share)
    }
  }

  const pending = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)

  return (
    <div className="page list">
      <header className="list-header">
        <button type="button" className="btn ghost back" onClick={() => navigateTo({ name: 'home' })}>
          ← Ana sayfa
        </button>
        <div className="list-title-row">
          <h1>Alışveriş listesi</h1>
          <p className="mono small code">{listId}</p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn secondary" onClick={() => void copyShare()}>
            {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
          </button>
          {done.length > 0 && (
            <button type="button" className="btn ghost" onClick={() => void clearBought()}>
              Alınanları temizle ({done.length})
            </button>
          )}
        </div>
      </header>

      {fireErr && <p className="error">{fireErr}</p>}

      <ul className="item-list" aria-label="Alınacaklar">
        {pending.length === 0 && <li className="empty">Henüz ürün yok. Aşağıdan ekleyin.</li>}
        {pending.map((item) => (
          <li key={item.id} className="item-row">
            <label className="check-wrap">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => void toggleDone(item)}
                aria-label={`${item.text} alındı`}
              />
              <span className="item-text">{item.text}</span>
            </label>
            <button type="button" className="btn icon danger" onClick={() => void removeItem(item)} title="Sil">
              ×
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="section-label">Alındı</h2>
          <ul className="item-list done" aria-label="Alınanlar">
            {done.map((item) => (
              <li key={item.id} className="item-row done">
                <label className="check-wrap">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => void toggleDone(item)}
                    aria-label={`${item.text} geri al`}
                  />
                  <span className="item-text">{item.text}</span>
                </label>
                <button type="button" className="btn icon danger" onClick={() => void removeItem(item)} title="Sil">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <form
        className="add-bar"
        onSubmit={(e) => {
          e.preventDefault()
          void addItem()
        }}
      >
        <input
          className="field-input grow"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Örn: süt, ekmek…"
          enterKeyHint="done"
          aria-label="Yeni ürün"
        />
        <button type="submit" className="btn primary" disabled={!newText.trim()}>
          Ekle
        </button>
      </form>
    </div>
  )
}
