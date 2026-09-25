// Tiny IndexedDB wrapper. Keeps admin-uploaded base videos on this device until the backend exists.
const DB_NAME = 'signpak-blobs'
const STORE = 'videos'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run(mode, action) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = action(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(transaction.error)
  })
}

export const blobStore = {
  put: (key, blob) => run('readwrite', (store) => store.put(blob, key)),
  get: (key) => run('readonly', (store) => store.get(key)),
  remove: (key) => run('readwrite', (store) => store.delete(key)),
}
