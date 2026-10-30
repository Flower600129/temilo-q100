import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { addPersonSchema, emptySnapshot, snapshotSchema, type Person, type Occasion, type Wish, type InventoryItem, type GiftRecord, type TasteRun, type Snapshot } from '@/domain/schemas';
import { demoSeed } from './demo-seed';

export type DataMode = 'personal' | 'demo';
interface GiftMemoryDB extends DBSchema {
  people: { key: string; value: Person };
  occasions: { key: string; value: Occasion; indexes: { personId: string } };
  wishes: { key: string; value: Wish };
  inventory: { key: string; value: InventoryItem };
  gifts: { key: string; value: GiftRecord; indexes: { operationId: string } };
  tasteRuns: { key: string; value: TasteRun };
}
export const stores = ['people', 'occasions', 'wishes', 'inventory', 'gifts', 'tasteRuns'] as const;
export const databaseName = (mode: DataMode) => `gift-memory-${mode}`;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;

export function subscribeToChanges(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' && !channel) {
    channel = new BroadcastChannel('gift-memory-changes');
    channel.onmessage = () => listeners.forEach((callback) => callback());
  }
  return () => { listeners.delete(listener); };
}
function notify() {
  listeners.forEach((listener) => listener());
  channel?.postMessage('changed');
}

export class MemoryRepository {
  constructor(readonly mode: DataMode) {}

  private async withDB<T>(work: (db: IDBPDatabase<GiftMemoryDB>) => Promise<T>): Promise<T> {
    if (typeof indexedDB === 'undefined') throw new Error('Browser storage is unavailable.');
    const db = await openDB<GiftMemoryDB>(databaseName(this.mode), 1, {
      upgrade(db) {
        db.createObjectStore('people', { keyPath: 'id' });
        db.createObjectStore('occasions', { keyPath: 'id' }).createIndex('personId', 'personId');
        db.createObjectStore('wishes', { keyPath: 'id' });
        db.createObjectStore('inventory', { keyPath: 'id' });
        db.createObjectStore('gifts', { keyPath: 'id' }).createIndex('operationId', 'operationId', { unique: true });
        db.createObjectStore('tasteRuns', { keyPath: 'id' });
      },
      blocking() { db.close(); },
    });
    try { return await work(db); } finally { db.close(); }
  }

  async read(): Promise<Snapshot> {
    return this.withDB(async (db) => {
      const tx = db.transaction([...stores], 'readonly');
      const values = await Promise.all(stores.map((name) => tx.objectStore(name).getAll()));
      await tx.done;
      return snapshotSchema.parse({ schemaVersion: 1, ...Object.fromEntries(stores.map((name, index) => [name, values[index]])) });
    });
  }

  async addPerson(input: unknown, operationId = crypto.randomUUID()): Promise<Person> {
    const value = addPersonSchema.parse(input);
    const now = new Date().toISOString();
    const person: Person = { id: operationId, displayName: value.displayName, interests: [], createdAt: now, updatedAt: now };
    const occasion: Occasion = { id: crypto.randomUUID(), personId: person.id, type: 'birthday', label: 'Birthday', monthDay: value.monthDay, recurrence: 'annual', reminderDaysBefore: [14, 7, 1] };
    snapshotSchema.parse({ ...emptySnapshot(), people: [person], occasions: [occasion] });
    const saved = await this.withDB(async (db) => {
      const tx = db.transaction(['people', 'occasions'], 'readwrite');
      try {
        const existing = await tx.objectStore('people').get(person.id);
        if (existing) {
          const birthdays = await tx.objectStore('occasions').index('personId').getAll(person.id);
          if (existing.displayName !== person.displayName || !birthdays.some((o) => o.type === 'birthday' && o.monthDay === value.monthDay)) throw new Error('Operation ID was reused with different data.');
          await tx.done;
          return existing;
        }
        await tx.objectStore('people').add(person);
        await tx.objectStore('occasions').add(occasion);
        await tx.done;
        return person;
      } catch (error) {
        try { tx.abort(); } catch { /* already aborted or committed */ }
        await tx.done.catch(() => {});
        throw error;
      }
    });
    notify();
    return saved;
  }

  // P0 deliberately has no public gift/stock mutation API. Those invariants ship in P2.
  async resetDemo(): Promise<void> {
    if (this.mode !== 'demo') throw new Error('Only demo data can be reset.');
    await this.replaceDemo(demoSeed());
  }

  async ensureDemo(): Promise<void> {
    if (this.mode !== 'demo') throw new Error('Demo operation requires demo mode.');
    await this.replaceDemo(demoSeed(), true);
  }

  private async replaceDemo(input: Snapshot, onlyIfEmpty = false): Promise<void> {
    const snapshot = snapshotSchema.parse(input);
    await this.withDB(async (db) => {
      const tx = db.transaction([...stores], 'readwrite');
      try {
        const counts = await Promise.all(stores.map((name) => tx.objectStore(name).count()));
        if (onlyIfEmpty && counts.some(Boolean)) { await tx.done; return; }
        for (const name of stores) {
          await tx.objectStore(name).clear();
          for (const record of snapshot[name]) await tx.objectStore(name).put(record);
        }
        await tx.done;
      } catch (error) {
        try { tx.abort(); } catch { /* transaction already finished */ }
        await tx.done.catch(() => {});
        throw error;
      }
    });
    notify();
  }
}
