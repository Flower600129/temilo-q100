import * as Crypto from 'expo-crypto';
import { openDB, type IDBPDatabase } from 'idb';
import legacy from 'expo-sqlite/kv-store';
import { SnapshotRepository, type DataMode, type KeyValueStore } from '../../../src/domain/snapshot-repository';
import { snapshotSchema } from '../../../src/domain/schemas';

const modeKey = 'gift-memory-native-mode-v1';
const migrationKey = 'legacy-sqlite-imported-v1';
let database: Promise<IDBPDatabase> | undefined;
let channel: BroadcastChannel | undefined;
const notifications = () => typeof BroadcastChannel === 'undefined' ? undefined : channel ??= new BroadcastChannel('gift-memory-mobile-web-changes');

async function lock<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.reject(new Error('Use a current browser on localhost or HTTPS to safely access saved data.'));
  return await navigator.locks.request(key, action);
}

async function connect(): Promise<IDBPDatabase> {
  const db = await openDB('gift-memory-mobile-web', 1, { upgrade(value) { value.createObjectStore('values'); } });
  try {
    await lock('gift-memory-mobile-web-migration', async () => {
      if (await db.get('values', migrationKey)) return;
      // Import all three old values before committing anything. Keep the original
      // SQLite database as a recovery copy, and never mark a failed import done.
      // Keep SQLite in the eager graph: SDK 54's export can hoist shared
      // dependencies out of a dynamically imported Worker, leaving it unable
      // to start. The store still opens only here, under the migration lock;
      // the original SQLite records and recovery semantics are unchanged.
      const entries: [string, string][] = [];
      try {
        for (const key of ['gift-memory-native-v1-personal', 'gift-memory-native-v1-demo', modeKey]) {
          const value = await legacy.getItem(key);
          if (value === null) continue;
          if (key === modeKey) {
            if (value !== 'personal' && value !== 'demo') throw new Error('Invalid saved data-space preference.');
          } else snapshotSchema.parse(JSON.parse(value));
          entries.push([key, value]);
        }
      } catch {
        throw new Error('Could not import the earlier preview data. Close other older preview tabs and retry. Existing records have been preserved.');
      } finally { await legacy.closeAsync().catch(() => {}); }
      const tx = db.transaction('values', 'readwrite');
      for (const [key, value] of entries) await tx.store.put(value, key);
      await tx.store.put('complete', migrationKey);
      await tx.done;
    });
    return db;
  } catch (error) { db.close(); throw error; }
}

function getDB() {
  if (!database) database = connect().catch((error) => { database = undefined; throw error; });
  return database;
}
const store: KeyValueStore = {
  async getItem(key) { return (await (await getDB()).get('values', key)) ?? null; },
  async setItem(key, value) {
    await (await getDB()).put('values', value, key);
    try { notifications()?.postMessage('changed'); } catch { /* Commit already succeeded. */ }
  },
  withLock: (key, action) => lock(`gift-memory-mobile-web:${key}`, action),
};
const repositories = {
  personal: new SnapshotRepository('personal', store, Crypto.randomUUID),
  demo: new SnapshotRepository('demo', store, Crypto.randomUUID),
};
export const nativeRepository = (mode: DataMode) => repositories[mode];
export async function readDataMode(): Promise<DataMode> {
  const value = await store.getItem(modeKey);
  if (value !== null && value !== 'personal' && value !== 'demo') throw new Error('Saved data-space preference is invalid. Your records have been preserved.');
  return value ?? 'personal';
}
export const saveDataMode = (mode: DataMode) => store.setItem(modeKey, mode);
export function subscribeToChanges(listener: () => void): () => void {
  const value = notifications(); value?.addEventListener('message', listener);
  return () => value?.removeEventListener('message', listener);
}
