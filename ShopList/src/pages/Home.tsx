import { useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { navigateTo } from '../route'

type Props = {
  db: Firestore
}

export function Home({ db }: Props) {
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function createList() {
    setErr(null)
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      await setDoc(
        doc(db, 'shopLists', id),
        { createdAt: serverTimestamp() },
        { merge: true },
      )
      navigateTo({ name: 'list', listId: id })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function joinList() {
    setErr(null)
    const raw = joinCode.trim()
    const id = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1]
    if (!id) {
      setErr('Geçerli bir liste kodu veya bağlantı girin.')
      return
    }
    navigateTo({ name: 'list', listId: id.toLowerCase() })
  }

  return (
    <div className="page home">
      <header className="hero">
        <h1>ShopList</h1>
        <p className="subtitle">
          Eve alınacakları ekleyin; aynı listeyi açan diğer kişi ürünleri aldıkça işaretlesin.
        </p>
      </header>

      <section className="card">
        <h2>Yeni liste</h2>
        <p className="muted">Anneniz veya siz oluşturun, çıkan bağlantıyı veya kodu ailenizle paylaşın.</p>
        <button type="button" className="btn primary block" disabled={busy} onClick={() => void createList()}>
          {busy ? 'Oluşturuluyor…' : 'Yeni liste oluştur'}
        </button>
      </section>

      <section className="card">
        <h2>Listeye katıl</h2>
        <p className="muted">Paylaşılan bağlantıyı yapıştırabilir veya yalnızca liste kodunu girebilirsiniz.</p>
        <input
          className="field-input"
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="https://… veya 550e8400-e29b-…"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="button" className="btn secondary block" onClick={joinList}>
          Listeyi aç
        </button>
      </section>

      {err && <p className="error">{err}</p>}

      <footer className="home-foot">
        <p className="muted small">
          Ana ekrana eklemek için tarayıcı menüsünden “Ana ekrana ekle” / “Install app” kullanın.
        </p>
        <p className="muted small">
          Paylaşılan bağlantıda <span className="mono">#/list/</span> sonrası görünen kod, listenin kimliğidir.
        </p>
      </footer>
    </div>
  )
}
