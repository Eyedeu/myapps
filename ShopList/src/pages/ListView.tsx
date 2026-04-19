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
} from 'firebase/firestore'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { deleteShopList } from '../firebase/deleteShopList.ts'
import { defaultListTitle } from '../listTitle'
import { navigateTo } from '../route'
import type { ListItem } from '../types'

type Props = {
  db: Firestore
  listId: string
}

type ConfirmKind = null | 'remove-list'

export function ListView({ db, listId }: Props) {
  const [items, setItems] = useState<ListItem[]>([])
  const [newText, setNewText] = useState('')
  const [fireErr, setFireErr] = useState<string | null>(null)
  const [listTitle, setListTitle] = useState('')
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [deleting, setDeleting] = useState(false)
  const [dismissCompletePrompt, setDismissCompletePrompt] = useState(false)

  const itemsRef = useMemo(() => collection(db, 'shopLists', listId, 'items'), [db, listId])
  const listRef = useMemo(() => doc(db, 'shopLists', listId), [db, listId])

  useEffect(() => {
    const unsub = onSnapshot(
      listRef,
      (snap) => {
        if (!snap.exists()) {
          navigateTo({ name: 'home' })
          return
        }
        const data = snap.data() as { title?: unknown } | undefined
        const t = typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : ''
        setListTitle(t || defaultListTitle())
      },
      (e) => setFireErr(e.message),
    )
    return () => unsub()
  }, [listRef])

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
        const everyoneDone = next.length > 0 && next.every((i) => i.done)
        if (!everyoneDone) setDismissCompletePrompt(false)
      },
      (e) => setFireErr(e.message),
    )
    return () => unsub()
  }, [itemsRef])

  useEffect(() => {
    const total = items.length
    const pending = items.filter((i) => !i.done).length
    void updateDoc(listRef, { totalCount: total, pendingCount: pending }).catch(() => {})
  }, [items, listRef])

  const pending = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const allDone = items.length > 0 && pending.length === 0

  const showCompleteBanner = allDone && !dismissCompletePrompt

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

  async function commitTitle() {
    const t = listTitle.trim() || defaultListTitle()
    setListTitle(t)
    await updateDoc(listRef, { title: t }).catch(() => {})
  }

  async function runDeleteList() {
    setDeleting(true)
    setFireErr(null)
    try {
      await deleteShopList(db, listId)
      setConfirm(null)
      navigateTo({ name: 'home' })
    } catch (e) {
      setFireErr(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page list">
      <header className="list-header">
        <div className="list-header-top">
          <button type="button" className="btn ghost back" onClick={() => navigateTo({ name: 'home' })}>
            ← Listeler
          </button>
          <button type="button" className="btn ghost danger-text" onClick={() => setConfirm('remove-list')}>
            Listeyi kaldır
          </button>
        </div>
        <div className="list-title-edit">
          <label className="sr-only" htmlFor="list-title-input">
            Liste adı
          </label>
          <input
            id="list-title-input"
            className="list-title-input"
            value={listTitle}
            onChange={(e) => setListTitle(e.target.value)}
            onBlur={() => void commitTitle()}
            maxLength={80}
          />
        </div>
      </header>

      {fireErr && <p className="error">{fireErr}</p>}

      {showCompleteBanner && (
        <div className="complete-banner" role="status">
          <p className="complete-banner-text">Tüm ürünler alındı. Bu listeyi kapatıp tamamen silmek ister misiniz?</p>
          <div className="complete-banner-actions">
            <button type="button" className="btn secondary" disabled={deleting} onClick={() => setDismissCompletePrompt(true)}>
              Hayır, dursun
            </button>
            <button type="button" className="btn primary" disabled={deleting} onClick={() => void runDeleteList()}>
              {deleting ? 'Siliniyor…' : 'Evet, sil'}
            </button>
          </div>
        </div>
      )}

      <ul className="item-list" aria-label="Alınacaklar">
        {pending.length === 0 && items.length === 0 && (
          <li className="empty">Henüz ürün yok. Aşağıdan ekleyin.</li>
        )}
        {pending.length === 0 && items.length > 0 && <li className="empty subtle">Alınacak kalmadı.</li>}
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

      {confirm === 'remove-list' && (
        <ConfirmDialog
          title="Listeyi kaldır"
          message={
            items.length > 0
              ? 'Bu listedeki tüm ürünler ve liste kendisi kalıcı olarak silinecek.'
              : 'Boş liste kaldırılacak.'
          }
          cancelLabel="Vazgeç"
          confirmLabel={deleting ? 'Siliniyor…' : 'Kaldır'}
          danger
          busy={deleting}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (!deleting) void runDeleteList()
          }}
        />
      )}
    </div>
  )
}
