const DB_NAME = "pdf-pocket-studio";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "active-project";
const HISTORY_INDEX_KEY = "project-history-index";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshot() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(SNAPSHOT_KEY);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSnapshot(snapshot) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(snapshot, SNAPSHOT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadHistoryProjects() {
  const db = await openDatabase();
  const index = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(HISTORY_INDEX_KEY);

    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });

  const projects = await Promise.all(index.map((entry) => getStoreValue(db, entry.key)));
  return projects.filter(Boolean);
}

export async function saveHistoryProject(snapshot) {
  const db = await openDatabase();
  const projectId = snapshot.id;
  const key = `history:${projectId}`;
  const record = {
    ...snapshot,
    updatedAt: Date.now(),
    title: snapshot.title || "PDF Projesi",
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(HISTORY_INDEX_KEY);

    request.onsuccess = () => {
      const index = request.result ?? [];
      const nextIndex = [
        { key, id: projectId, title: record.title, updatedAt: record.updatedAt, pageCount: record.pages.length },
        ...index.filter((entry) => entry.id !== projectId),
      ].slice(0, 12);

      store.put(record, key);
      store.put(nextIndex, HISTORY_INDEX_KEY);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteHistoryProject(projectId) {
  const db = await openDatabase();
  const key = `history:${projectId}`;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const indexRequest = store.get(HISTORY_INDEX_KEY);

    indexRequest.onsuccess = () => {
      const index = indexRequest.result ?? [];
      store.delete(key);
      store.put(index.filter((entry) => entry.id !== projectId), HISTORY_INDEX_KEY);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getStoreValue(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
