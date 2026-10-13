/**
 * Almacén de binarios en IndexedDB para la demo: localStorage solo admite unos
 * pocos MB de texto, mientras que IndexedDB guarda Blobs grandes sin convertirlos.
 */
const DB_NAME = 'lamo-studio-files';
const STORE = 'blobs';

let connection: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = null;
      reject(request.error);
    };
  });
  return connection;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const blobStore = {
  put: (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined),
  get: (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id)),
  delete: (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined),
  clear: () => run('readwrite', (s) => s.clear()).then(() => undefined),
};
