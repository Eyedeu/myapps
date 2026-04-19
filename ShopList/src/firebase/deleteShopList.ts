import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

const BATCH = 450

/** Alt koleksiyondaki tüm `items` belgelerini ve liste kökünü siler. */
export async function deleteShopList(db: Firestore, listId: string): Promise<void> {
  const itemsCol = collection(db, 'shopLists', listId, 'items')
  for (;;) {
    const snap = await getDocs(query(itemsCol, limit(BATCH)))
    if (snap.empty) break
    const batch = writeBatch(db)
    for (const d of snap.docs) {
      batch.delete(d.ref)
    }
    await batch.commit()
  }
  await deleteDoc(doc(db, 'shopLists', listId))
}
