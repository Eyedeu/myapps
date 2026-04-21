import { Directory, Filesystem } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'

const INDEX_KEY = 'galery_photo_index_v1'
const PHOTOS_DIR = 'photos'

export type PhotoRecord = {
  id: string
  categoryId: string
  createdAt: number
}

export async function loadIndex(): Promise<PhotoRecord[]> {
  const { value } = await Preferences.get({ key: INDEX_KEY })
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as PhotoRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveIndex(records: PhotoRecord[]): Promise<void> {
  await Preferences.set({ key: INDEX_KEY, value: JSON.stringify(records) })
}

export async function savePhotoFile(id: string, base64Jpeg: string): Promise<void> {
  await Filesystem.writeFile({
    path: `${PHOTOS_DIR}/${id}.jpg`,
    data: base64Jpeg,
    directory: Directory.Data,
    recursive: true,
  })
}

export async function readPhotoDataUrl(id: string): Promise<string | null> {
  try {
    const { data } = await Filesystem.readFile({
      path: `${PHOTOS_DIR}/${id}.jpg`,
      directory: Directory.Data,
    })
    const base64 = typeof data === 'string' ? data : ''
    if (!base64) return null
    return `data:image/jpeg;base64,${base64}`
  } catch {
    return null
  }
}
