import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SnapshotRepository, type KeyValueStore } from '../src/domain/snapshot-repository';
import { allObjectsFixture } from './fixtures';

class TestStore implements KeyValueStore {
  readonly records = new Map<string, string>();
  failNextWrite = false;
  async getItem(key: string) { return this.records.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Disk write failed');
    }
    this.records.set(key, value);
  }
}

describe('native snapshot repository', () => {
  it('saves a person and birthday together and reads both from a fresh repository instance', async () => {
    const store = new TestStore();
    const first = new SnapshotRepository('personal', store, randomUUID);
    await first.addPerson({ displayName: '  Alex  ', monthDay: '02-29' });
    const reopened = new SnapshotRepository('personal', store, randomUUID);
    const snapshot = await reopened.read();
    expect(snapshot.people).toHaveLength(1);
    expect(snapshot.people[0].displayName).toBe('Alex');
    expect(snapshot.occasions).toHaveLength(1);
    expect(snapshot.occasions[0].personId).toBe(snapshot.people[0].id);
    expect(snapshot.occasions[0].monthDay).toBe('02-29');
    expect(snapshot.wishes).toEqual([]);
    expect(snapshot.inventory).toEqual([]);
    expect(snapshot.gifts).toEqual([]);
    expect(snapshot.tasteRuns).toEqual([]);
  });

  it('makes a repeated save idempotent and refuses reuse with changed data', async () => {
    const store = new TestStore();
    const repository = new SnapshotRepository('personal', store, randomUUID);
    const operationId = randomUUID();
    await Promise.all([
      repository.addPerson({ displayName: 'Alex', monthDay: '11-08' }, operationId),
      repository.addPerson({ displayName: 'Alex', monthDay: '11-08' }, operationId),
    ]);
    expect((await repository.read()).people).toHaveLength(1);
    expect((await repository.read()).occasions).toHaveLength(1);
    await expect(repository.addPerson({ displayName: 'Sam', monthDay: '11-08' }, operationId)).rejects.toThrow('different data');
  });

  it('preserves prior data if the single snapshot write fails', async () => {
    const store = new TestStore();
    const repository = new SnapshotRepository('personal', store, randomUUID);
    await repository.addPerson({ displayName: 'Alex', monthDay: '11-08' });
    store.failNextWrite = true;
    await expect(repository.addPerson({ displayName: 'Sam', monthDay: '01-01' })).rejects.toThrow('Disk write failed');
    const snapshot = await repository.read();
    expect(snapshot.people.map((person) => person.displayName)).toEqual(['Alex']);
    expect(snapshot.occasions).toHaveLength(1);
  });

  it('keeps demo data separate and resets only demo', async () => {
    const store = new TestStore();
    const personal = new SnapshotRepository('personal', store, randomUUID);
    const demo = new SnapshotRepository('demo', store, randomUUID);
    await personal.addPerson({ displayName: 'Private Alex', monthDay: '12-01' });
    await demo.ensureDemo();
    expect((await demo.read()).people.map((person) => person.displayName)).toEqual(['Avery', 'Jordan']);
    await demo.addPerson({ displayName: 'Demo Sam', monthDay: '10-10' });
    await demo.resetDemo();
    expect((await demo.read()).people.map((person) => person.displayName)).toEqual(['Avery', 'Jordan']);
    expect((await personal.read()).people.map((person) => person.displayName)).toEqual(['Private Alex']);
  });

  it('does not silently replace corrupt saved data', async () => {
    const store = new TestStore();
    store.records.set('gift-memory-native-v1-personal', '{broken');
    const repository = new SnapshotRepository('personal', store, randomUUID);
    await expect(repository.read()).rejects.toThrow();
    expect(store.records.get('gift-memory-native-v1-personal')).toBe('{broken');
  });

  it('edits optional profile details without changing identity or losing unrelated records', async () => {
    const store = new TestStore(); const repository = new SnapshotRepository('personal', store, randomUUID);
    const person = await repository.addPerson({ displayName: 'Alex', monthDay: '11-08' });
    const edited = await repository.updatePerson(person.id, { displayName: 'Alex Chen', relationship: 'Friend', interests: [{ label: 'Jane Austen' }], dislikes: ['Perfume'], notes: 'Private note' });
    expect(edited.id).toBe(person.id); expect(edited.createdAt).toBe(person.createdAt);
    expect((await repository.read()).occasions[0].personId).toBe(person.id);
    await repository.updatePerson(person.id, { displayName: 'Alex', interests: [] });
    expect((await repository.read()).people[0].notes).toBeUndefined();
    await expect(repository.updatePerson(person.id, { displayName: '', interests: [] })).rejects.toThrow();
    expect((await repository.read()).people[0].displayName).toBe('Alex');
  });

  it('edits dates, deduplicates reminder offsets and rejects invalid or duplicate birthdays', async () => {
    const repository = new SnapshotRepository('personal', new TestStore(), randomUUID);
    const person = await repository.addPerson({ displayName: 'Alex', monthDay: '11-08' });
    const birthday = (await repository.read()).occasions[0];
    await repository.saveOccasion(person.id, { ...dateInput, type: 'birthday', label: 'Birthday', monthDay: '02-29', reminderDaysBefore: [1, 14, 1] }, birthday.id);
    expect((await repository.read()).occasions[0].reminderDaysBefore).toEqual([14, 1]);
    await expect(repository.saveOccasion(person.id, { ...dateInput, type: 'birthday' })).rejects.toThrow('already has a birthday');
    await expect(repository.saveOccasion(person.id, { ...dateInput, recurrence: 'once', monthDay: '02-29', year: 2027 })).rejects.toThrow();
    await expect(repository.saveOccasion(person.id, { ...dateInput, recurrence: 'once' })).rejects.toThrow();
    await expect(repository.saveOccasion(person.id, { ...dateInput, reminderDaysBefore: [-1] })).rejects.toThrow();
    const anniversary = await repository.saveOccasion(person.id, dateInput);
    await repository.deleteOccasion(person.id, anniversary.id);
    await repository.deleteOccasion(person.id, anniversary.id);
    expect((await repository.read()).occasions).toHaveLength(1);
  });

  it('rejects edits of another person’s dates and records for missing people', async () => {
    const repository = new SnapshotRepository('personal', new TestStore(), randomUUID);
    const a = await repository.addPerson({ displayName: 'A', monthDay: '11-08' });
    const b = await repository.addPerson({ displayName: 'B', monthDay: '12-01' });
    const date = (await repository.read()).occasions.find((entry) => entry.personId === a.id)!;
    await expect(repository.saveOccasion(b.id, dateInput, date.id)).rejects.toThrow('another person');
    await expect(repository.deleteOccasion(b.id, date.id)).rejects.toThrow('another person');
    await expect(repository.saveOccasion(randomUUID(), dateInput)).rejects.toThrow('no longer exists');
    await expect(repository.updatePerson(randomUUID(), { displayName: 'Missing' })).rejects.toThrow('no longer exists');
  });

  it('cascades person deletion to their dates and wishes while preserving inventory and other people', async () => {
    const store = new TestStore(); const repository = new SnapshotRepository('demo', store, randomUUID);
    await repository.ensureDemo(); const before = await repository.read();
    await repository.deletePerson(before.people[0].id);
    await repository.deletePerson(before.people[0].id);
    const after = await repository.read();
    expect(after.people).toHaveLength(1); expect(after.occasions).toHaveLength(1); expect(after.wishes).toEqual([]);
    expect(after.inventory).toEqual(before.inventory);
  });

  it('protects gift and taste history and linked occasions from deletion', async () => {
    const store = new TestStore(); const data = allObjectsFixture();
    data.gifts[0].occasionId = data.occasions[0].id;
    store.records.set('gift-memory-native-v1-personal', JSON.stringify(data));
    const repository = new SnapshotRepository('personal', store, randomUUID);
    await expect(repository.deletePerson(data.people[0].id)).rejects.toThrow('history');
    await expect(repository.deleteOccasion(data.people[0].id, data.occasions[0].id)).rejects.toThrow('history');
    expect(await repository.read()).toEqual(data);
  });

  it('preserves the entire prior snapshot when profile or cascade deletion writes fail', async () => {
    const store = new TestStore(); const repository = new SnapshotRepository('personal', store, randomUUID);
    const person = await repository.addPerson({ displayName: 'Alex', monthDay: '11-08' });
    const before = await repository.read();
    store.failNextWrite = true;
    await expect(repository.updatePerson(person.id, { displayName: 'Changed' })).rejects.toThrow('Disk write failed');
    expect(await repository.read()).toEqual(before);
    store.failNextWrite = true;
    await expect(repository.deletePerson(person.id)).rejects.toThrow('Disk write failed');
    expect(await repository.read()).toEqual(before);
  });

  it('serializes simultaneous profile/date edits and uses the storage lock boundary', async () => {
    const store = new TestStore(); let locks = 0;
    const locked = { getItem: store.getItem.bind(store), setItem: store.setItem.bind(store), async withLock<T>(_key: string, action: () => Promise<T>) { locks++; return action(); } };
    const repository = new SnapshotRepository('personal', locked, randomUUID);
    const person = await repository.addPerson({ displayName: 'Alex', monthDay: '11-08' });
    await Promise.all([repository.updatePerson(person.id, { displayName: 'Edited' }), repository.saveOccasion(person.id, dateInput)]);
    const after = await repository.read();
    expect(after.people[0].displayName).toBe('Edited'); expect(after.occasions).toHaveLength(2); expect(locks).toBe(4);
  });
});

const dateInput = { type: 'anniversary', label: 'Friendship day', monthDay: '01-01', recurrence: 'annual', reminderDaysBefore: [14, 7, 1] } as const;
