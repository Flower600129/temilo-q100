import 'fake-indexeddb/auto';
import { deleteDB, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { databaseName, MemoryRepository, stores } from '@/storage/repository';
import { allObjectsFixture } from './fixtures';

beforeEach(async () => { await deleteDB(databaseName('personal')); await deleteDB(databaseName('demo')); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('IndexedDB repository', () => {
  it('saves a person and birthday and survives a fresh repository instance', async () => {
    await new MemoryRepository('personal').addPerson({ displayName: 'Alex', monthDay: '11-08' });
    const saved = await new MemoryRepository('personal').read();
    expect(saved.people).toHaveLength(1); expect(saved.occasions[0].personId).toBe(saved.people[0].id);
    expect(saved.occasions[0].monthDay).toBe('11-08');
  });
  it('deduplicates concurrent submissions with the same operation id', async () => {
    const id = crypto.randomUUID(); const input = { displayName: 'Alex', monthDay: '11-08' };
    await Promise.all([new MemoryRepository('personal').addPerson(input, id), new MemoryRepository('personal').addPerson(input, id)]);
    const saved = await new MemoryRepository('personal').read(); expect(saved.people).toHaveLength(1); expect(saved.occasions).toHaveLength(1);
  });
  it('rejects reuse of an operation id with different data', async () => {
    const repo = new MemoryRepository('personal'); const id = crypto.randomUUID();
    await repo.addPerson({ displayName: 'Alex', monthDay: '11-08' }, id);
    await expect(repo.addPerson({ displayName: 'Jordan', monthDay: '11-08' }, id)).rejects.toThrow('reused');
  });
  it('rolls back the person if the birthday write fails', async () => {
    const original = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, value, key) {
      if (this.name === 'occasions') throw new DOMException('Test write failure', 'QuotaExceededError');
      return original.call(this, value, key);
    });
    const repo = new MemoryRepository('personal');
    await expect(repo.addPerson({ displayName: 'Alex', monthDay: '11-08' })).rejects.toThrow();
    expect((await repo.read()).people).toHaveLength(0);
  });
  it('persists all six typed stores and reads them after reopening', async () => {
    const repo = new MemoryRepository('personal'); await repo.read();
    const fixture = allObjectsFixture(); const db = await openDB(databaseName('personal'), 1);
    const tx = db.transaction([...stores], 'readwrite');
    for (const name of stores) for (const value of fixture[name]) await tx.objectStore(name).put(value);
    await tx.done; db.close();
    const saved = await new MemoryRepository('personal').read();
    for (const name of stores) expect(saved[name]).toEqual(fixture[name]);
  });
  it('isolates demo resets and never seeds demo implicitly', async () => {
    const personal = new MemoryRepository('personal'); const demo = new MemoryRepository('demo');
    await personal.addPerson({ displayName: 'Real-space fixture', monthDay: '01-01' });
    expect((await demo.read()).people).toHaveLength(0);
    await demo.ensureDemo(); await demo.addPerson({ displayName: 'Extra sample', monthDay: '04-01' });
    await demo.ensureDemo(); expect((await demo.read()).people).toHaveLength(3);
    await demo.resetDemo(); expect((await demo.read()).people).toHaveLength(2);
    expect((await personal.read()).people[0].displayName).toBe('Real-space fixture');
    await expect(personal.resetDemo()).rejects.toThrow();
  });
  it('reports unavailable storage rather than silently saving in memory', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(new MemoryRepository('personal').read()).rejects.toThrow('unavailable');
  });
  it('preserves corrupt data and rejects unknown future versions', async () => {
    const repo = new MemoryRepository('personal'); await repo.read();
    const db = await openDB(databaseName('personal'), 1);
    await db.put('people', { id: 'bad', displayName: 'Do not erase' }); db.close();
    await expect(repo.read()).rejects.toThrow();
    const inspection = await openDB(databaseName('personal'), 1); expect(await inspection.count('people')).toBe(1); inspection.close();
    const future = await openDB(databaseName('personal'), 2); future.close();
    await expect(repo.read()).rejects.toThrow();
  });
});
