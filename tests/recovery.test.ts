import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SnapshotRepository, type KeyValueStore } from '../src/domain/snapshot-repository';
import { giftDirections } from '../src/domain/gift-ideas';
import { checkGift } from '../src/domain/gift-check';

class Store implements KeyValueStore {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('R1 recovery regressions (synthetic local records only)', () => {
  it('F07 allows a name-only profile, then an independently saved birthday', async () => {
    const repo = new SnapshotRepository('personal', new Store(), randomUUID);
    const person = await repo.addPerson({ displayName: 'No birthday yet' });
    expect((await repo.read()).occasions).toEqual([]);
    await repo.saveOccasion(person.id, { type: 'birthday', label: 'Birthday', monthDay: '02-29', recurrence: 'annual', reminderDaysBefore: [60] });
    expect((await repo.read()).occasions).toHaveLength(1);
  });

  it('F08 normalizes reminder identity and rejects a changed operation retry', async () => {
    const repo = new SnapshotRepository('personal', new Store(), randomUUID);
    const id = randomUUID();
    await repo.addPerson({ displayName: 'Reminder test', monthDay: '11-08', reminderDaysBefore: [30, 7, 30] }, id);
    await repo.addPerson({ displayName: 'Reminder test', monthDay: '11-08', reminderDaysBefore: [7, 30] }, id);
    await expect(repo.addPerson({ displayName: 'Reminder test', monthDay: '11-08', reminderDaysBefore: [60] }, id)).rejects.toThrow('different data');
    expect((await repo.read()).occasions[0].reminderDaysBefore).toEqual([30, 7]);
  });

  it('F04 feedback preserves the original preparation note', async () => {
    const repo = new SnapshotRepository('personal', new Store(), randomUUID);
    const person = await repo.addPerson({ displayName: 'Notes', monthDay: '11-08' });
    const gift = await repo.createGift({ personId: person.id, itemSource: 'external', quantity: 1, giftTitle: 'A book', note: 'Wrap in blue paper.' });
    await repo.confirmGift(gift.id);
    await repo.updateGiftFeedback(gift.id, 'They enjoyed it.');
    expect((await repo.read()).gifts[0]).toMatchObject({ note: 'Wrap in blue paper.', feedback: 'They enjoyed it.' });
  });

  it('F06 recognizes the application template title already given', async () => {
    const repo = new SnapshotRepository('personal', new Store(), randomUUID);
    const person = await repo.addPerson({ displayName: 'Duplicate test', monthDay: '11-08' });
    const entities = [{ entityId: 'synthetic-test-book', name: 'Audit Book', entityType: 'urn:entity:book' }];
    const idea = giftDirections(await repo.read(), person.id, entities)[0];
    const gift = await repo.createGift({ personId: person.id, itemSource: 'external', quantity: 1, giftTitle: idea.title });
    await repo.confirmGift(gift.id);
    expect(giftDirections(await repo.read(), person.id, entities)).toEqual([]);
    await repo.cancelGift(gift.id);
    expect(giftDirections(await repo.read(), person.id, entities)).toHaveLength(1);
  });

  it('F03 checks requested quantity instead of only positive stock', async () => {
    const repo = new SnapshotRepository('personal', new Store(), randomUUID);
    const person = await repo.addPerson({ displayName: 'Stock test', monthDay: '11-08' });
    const item = await repo.saveInventory({ title: 'Tea set', quantity: 1 });
    const candidate = { title: item.title, inventoryItemId: item.id, quantity: 2 };
    expect(checkGift(await repo.read(), person.id, candidate).some((check) => check.kind === 'conflict' && check.message.includes('stock'))).toBe(true);
  });

  it('keeps a recovery copy before modifying an older nonempty snapshot', async () => {
    const store = new Store();
    const repo = new SnapshotRepository('personal', store, randomUUID);
    const person = await repo.addPerson({ displayName: 'Legacy', monthDay: '11-08' });
    const old = store.values.get('gift-memory-native-v1-personal')!;
    // Simulate a pre-upgrade space without a technical recovery key.
    store.values.delete('gift-memory-native-v1-personal-recovery-r1');
    await repo.updatePerson(person.id, { displayName: 'Updated', interests: [] });
    expect(store.values.get('gift-memory-native-v1-personal-recovery-r1')).toBe(old);
  });
});

describe('R3 category-aware provenance', () => {
  it('retains colliding source/target categories through save and frozen plan evidence', async () => {
    const store = new Store(); const repo = new SnapshotRepository('personal', store, randomUUID);
    const person = await repo.addPerson({ displayName: 'Synthetic provenance test' });
    const shared = randomUUID(); const runId = randomUUID();
    const source = { entityId: shared, entityType: 'urn:entity:artist', name: 'FIXTURE ARTIST' };
    const target = { entityId: shared, entityType: 'urn:entity:book', name: 'FIXTURE BOOK' };
    const suggestions = giftDirections(await repo.read(), person.id, [target]);
    await repo.saveTasteRun({ id: runId, personId: person.id, inputSignals: [{ original: 'Public cultural fixture', matched: true, qlooEntityId: shared, qlooEntityType: source.entityType }], requestStatus: 'success', qlooEvidence: [source, target], suggestions, createdAt: new Date().toISOString() });
    const gift = await repo.createGift({ personId: person.id, itemSource: 'external', quantity: 1, giftTitle: suggestions[0].title, tasteRunId: runId, suggestionId: suggestions[0].id });
    expect(gift.tasteSnapshot?.evidence).toEqual([source, target]);
    const reopened = new SnapshotRepository('personal', store, randomUUID);
    expect((await reopened.read()).tasteRuns[0].inputSignals[0].qlooEntityType).toBe(source.entityType);
    expect((await reopened.read()).gifts[0].tasteSnapshot?.evidence).toEqual([source, target]);
  });
  it('reads older runs without a signal category without rewriting stored data', async () => {
    const store = new Store(); const repo = new SnapshotRepository('personal', store, randomUUID);
    const person = await repo.addPerson({ displayName: 'Legacy synthetic record' });
    const entity = { entityId: randomUUID(), name: 'OLD FIXTURE BOOK', entityType: 'urn:entity:book' };
    await repo.saveTasteRun({ id: randomUUID(), personId: person.id, inputSignals: [{ original: 'Old fixture', matched: true, qlooEntityId: entity.entityId }], requestStatus: 'success', qlooEvidence: [entity], suggestions: giftDirections(await repo.read(), person.id, [entity]), createdAt: new Date().toISOString() });
    const raw = store.values.get('gift-memory-native-v1-personal');
    expect((await repo.read()).tasteRuns[0].inputSignals[0].qlooEntityType).toBeUndefined();
    expect(store.values.get('gift-memory-native-v1-personal')).toBe(raw);
  });
});
