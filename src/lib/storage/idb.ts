/** Minimal IndexedDB wrapper. Everything stays in this browser profile; nothing leaves the machine. */
import type { Id, Project } from '../model/types';

const DB_NAME = 'elektroplan';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of ['projects', 'blobs', 'meta']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
  });
}

export const saveProject = async (p: Project) => {
  await request('projects', 'readwrite', (s) => s.put(p, p.id));
  await request('meta', 'readwrite', (s) => s.put(p.id, 'lastProjectId'));
};

export async function loadLastProject(): Promise<Project | null> {
  const id = await request<Id | undefined>('meta', 'readonly', (s) => s.get('lastProjectId'));
  if (!id) return null;
  return (await request<Project | undefined>('projects', 'readonly', (s) => s.get(id))) ?? null;
}

export const putBlob = async (key: Id, blob: Blob): Promise<void> => {
  await request('blobs', 'readwrite', (s) => s.put(blob, key));
};
export const getBlob = (key: Id) => request<Blob | undefined>('blobs', 'readonly', (s) => s.get(key));
