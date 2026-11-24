// Generated chant audio, kept per passage in IndexedDB so a replay is instant and needs no model. Every call fails
// soft (private windows, blocked storage): the worst case is that a chant is generated again.
const DB = "upasarathi-tts";
const STORE = "chant";

export interface SavedChant {
  blob: Blob;
  duration: number;
  meter: string;
  provider: string;
  createdAt: number;
}

let dbp: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return (dbp ||= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve((req.result as T) ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const getChant = (key: string) => run<SavedChant>("readonly", (s) => s.get(key));
export const hasChant = (key: string) => run<IDBValidKey>("readonly", (s) => s.getKey(key)).then((k) => k !== null && k !== undefined);
export const putChant = (key: string, value: SavedChant) => run<IDBValidKey>("readwrite", (s) => s.put(value, key)).then((k) => k !== null);
export const deleteChant = (key: string) => run<undefined>("readwrite", (s) => s.delete(key));
