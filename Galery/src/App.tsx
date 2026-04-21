import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { CATEGORIES, categoryLabel } from './categories'
import {
  loadIndex,
  readPhotoDataUrl,
  saveIndex,
  savePhotoFile,
  type PhotoRecord,
} from './storage'
import './App.css'

type PhotoItem = PhotoRecord & { dataUrl: string | null }

export default function App() {
  const defaultCategory = CATEGORIES[0]?.id ?? 'other'
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultCategory)
  const [galleryFilter, setGalleryFilter] = useState<string | 'all'>('all')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [loadingIndex, setLoadingIndex] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshFromStorage = useCallback(async () => {
    setLoadingIndex(true)
    setError(null)
    try {
      const index = await loadIndex()
      const sorted = [...index].sort((a, b) => b.createdAt - a.createdAt)
      const withUrls: PhotoItem[] = await Promise.all(
        sorted.map(async (p) => ({
          ...p,
          dataUrl: await readPhotoDataUrl(p.id),
        })),
      )
      setPhotos(withUrls)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Liste yüklenemedi.'
      setError(message)
    } finally {
      setLoadingIndex(false)
    }
  }, [])

  useEffect(() => {
    void refreshFromStorage()
  }, [refreshFromStorage])

  const visiblePhotos = useMemo(() => {
    if (galleryFilter === 'all') return photos
    return photos.filter((p) => p.categoryId === galleryFilter)
  }, [photos, galleryFilter])

  const capture = async () => {
    setCapturing(true)
    setError(null)
    try {
      const perm = await Camera.checkPermissions()
      if (perm.camera !== 'granted') {
        const req = await Camera.requestPermissions({ permissions: ['camera'] })
        if (req.camera !== 'granted') {
          setError('Kamera izni gerekli.')
          return
        }
      }

      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      })

      const base64 = photo.base64String
      if (!base64) {
        setError('Fotoğraf verisi alınamadı.')
        return
      }

      const id = crypto.randomUUID()
      await savePhotoFile(id, base64)

      const record: PhotoRecord = {
        id,
        categoryId: selectedCategoryId,
        createdAt: Date.now(),
      }
      const index = await loadIndex()
      await saveIndex([record, ...index])

      setPhotos((prev) => [
        { ...record, dataUrl: `data:image/jpeg;base64,${base64}` },
        ...prev,
      ])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Çekim iptal edildi veya hata oluştu.'
      setError(message)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Galery</h1>
        <p className="tagline">Önce kategori seçin, sonra çekin; fotoğraflar bu uygulamada kategorilere göre listelenir.</p>
      </header>

      <section className="panel" aria-labelledby="capture-heading">
        <h2 id="capture-heading">Çekim</h2>
        <p className="hint">Aktif kategori: <strong>{categoryLabel(selectedCategoryId)}</strong></p>

        <div className="chips" role="group" aria-label="Kategori seçimi">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${selectedCategoryId === c.id ? 'chip-active' : ''}`}
              onClick={() => setSelectedCategoryId(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="primary"
          onClick={() => void capture()}
          disabled={capturing}
        >
          {capturing ? 'Kamera açılıyor…' : 'Fotoğraf çek'}
        </button>
      </section>

      <section className="panel" aria-labelledby="gallery-heading">
        <div className="gallery-head">
          <h2 id="gallery-heading">Galeri</h2>
          {loadingIndex ? <span className="muted">Yükleniyor…</span> : null}
        </div>

        <div className="chips" role="group" aria-label="Galeri filtresi">
          <button
            type="button"
            className={`chip ${galleryFilter === 'all' ? 'chip-active' : ''}`}
            onClick={() => setGalleryFilter('all')}
          >
            Tümü
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${galleryFilter === c.id ? 'chip-active' : ''}`}
              onClick={() => setGalleryFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {!loadingIndex && visiblePhotos.length === 0 ? (
          <p className="empty">Bu filtrede henüz fotoğraf yok.</p>
        ) : null}

        <ul className="grid">
          {visiblePhotos.map((p) => (
            <li key={p.id} className="tile">
              {p.dataUrl ? (
                <img src={p.dataUrl} alt="" className="thumb" />
              ) : (
                <div className="thumb-missing">Önizleme yok</div>
              )}
              <span className="badge">{categoryLabel(p.categoryId)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
