// Tiny IndexedDB wrapper: one JSON document for the library, one store for audio blobs.
// Everything lives on this computer: stash has no server.
import type { LibraryState } from "./types";

let dbPromise: Promise<IDBDatabase> | null = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("stash", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
      req.result.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(store: "kv" | "files", mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = op(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const loadState = () => run<LibraryState | undefined>("kv", "readonly", (s) => s.get("state"));
export const saveState = (state: LibraryState) => run<void>("kv", "readwrite", (s) => s.put(state, "state"));
export const putFile = (id: string, blob: Blob) => run<void>("files", "readwrite", (s) => s.put(blob, id));
export const getFile = (id: string) => run<Blob | undefined>("files", "readonly", (s) => s.get(id));
export const deleteFile = (id: string) => run<void>("files", "readwrite", (s) => s.delete(id));
export const clearFiles = () => run<void>("files", "readwrite", (s) => s.clear());
// small per-computer settings (the chosen folder); values may be file handles, which IndexedDB can store
export const getSetting = <T,>(key: string) => run<T | undefined>("kv", "readonly", (s) => s.get(key));
export const setSetting = (key: string, value: unknown) => run<void>("kv", "readwrite", (s) => s.put(value, key));
