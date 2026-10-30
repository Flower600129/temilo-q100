import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SnapshotRepository, type KeyValueStore } from '../src/domain/snapshot-repository';
import { giftContextFor, readGiftContext, resolveGiftTask, validateOccasionDate } from '../src/domain/gift-context';
import { giftInputFromRecord, suggestionKey } from '../src/domain/gift-sources';
import { checkGift, giftCheckFingerprint } from '../src/domain/gift-check';
import { giftDirections } from '../src/domain/gift-ideas';
import { snapshotSchema, type GiftInput, type TasteRun } from '../src/domain/schemas';
import { demoSeed } from '../src/storage/demo-seed';

class Store implements KeyValueStore {
  values = new Map<string, string>();
  failKey?: string;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('Synthetic disk failure');
    this.values.set(key, value);
  }
}
const personalKey = 'gift-memory-native-v1-personal';
async function fixture() {
  const store = new Store();
  const initial = demoSeed();
  store.values.set(personalKey, JSON.stringify(initial));
  const repo = new SnapshotRepository('personal', store, randomUUID);
  const personId = initial.people[0].id;
  const input: GiftInput = { personId, itemSource: 'external', quantity: 1, giftTitle: 'Synthetic gift', note: 'Private wrapping instruction' };
  return { store, repo, initial, personId, input };
}
function syntheticRun(personId: string): TasteRun {
  // Persistence fixture only: never a substitute for a Qloo HTTP response.
  return { id: randomUUID(), personId, inputSignals: [], requestStatus: 'partial',
    qlooEvidence: [{ entityId: 'fixture-book', entityType: 'urn:entity:book', name: 'Fixture book', score: 0.5, scoreField: 'affinity' }],
    suggestions: [{ title: 'An edition of Fixture book', rationale: 'Synthetic persistence evidence', limitations: ['Test only'], evidenceEntityIds: ['fixture-book'] }],
    createdAt: '2026-10-24T00:00:00.000Z' };
}

describe('gift task continuity and compatibility', () => {
  it('pins the next occurrence across a year boundary and keeps private text out of navigation', async () => {
    const { repo, initial, personId, input } = await fixture();
    const date = await repo.saveOccasion(personId, { type: 'anniversary', label: 'Anniversary', monthDay: '01-01', recurrence: 'annual', reminderDaysBefore: [60] });
    const task = resolveGiftTask(await repo.read(), { personId, occasionId: date.id }, undefined, new Date(2026, 11, 20));
    expect(task.input.occasionDate).toBe('2027-01-01');
    const draft = { input: { ...task.input, ...input, occasionId: date.id, occasionDate: '2027-01-01', inventoryItemId: initial.inventory[0].id, itemSource: 'inventory' as const, quantity: 2 } };
    const context = giftContextFor(draft.input, { draftId: randomUUID() });
    expect(JSON.stringify(context)).not.toMatch(/Synthetic gift|Private wrapping/);
    expect(resolveGiftTask(await repo.read(), readGiftContext(context), draft, new Date(2027, 0, 2)).input).toEqual(draft.input);
  });

  it('binds annual leap days and one-time dates to the concrete year', async () => {
    const { repo, personId } = await fixture();
    const leap = await repo.saveOccasion(personId, { type: 'other', label: 'Leap celebration', monthDay: '02-29', recurrence: 'annual', reminderDaysBefore: [30] });
    const data = await repo.read();
    expect(() => validateOccasionDate(data, personId, leap.id, '2027-02-28')).not.toThrow();
    expect(() => validateOccasionDate(data, personId, leap.id, '2028-02-29')).not.toThrow();
    expect(() => validateOccasionDate(data, personId, leap.id, '2028-02-28')).toThrow('changed');
    const once = await repo.saveOccasion(personId, { type: 'other', label: 'One time', monthDay: '12-01', year: 2026, recurrence: 'once', reminderDaysBefore: [60] });
    expect(() => validateOccasionDate({ ...data, occasions: [...data.occasions, once] }, personId, once.id, '2027-12-01')).toThrow('changed');
  });

  it('rejects deleted, wrong-owner, invalid and expired task references without silently starting over', async () => {
    const { initial, personId } = await fixture();
    expect(() => readGiftContext({ personId: 'bad' })).toThrow('gift link is invalid');
    expect(() => resolveGiftTask(initial, { personId, occasionId: randomUUID() })).toThrow('occasion');
    expect(() => resolveGiftTask(initial, { personId: initial.people[1].id, occasionId: initial.occasions[0].id })).toThrow('occasion');
    expect(() => resolveGiftTask(initial, { personId, draftId: randomUUID() })).toThrow('expired');
    expect(() => resolveGiftTask(initial, { personId, planId: randomUUID() })).toThrow('record');
    expect(() => resolveGiftTask(initial, { personId: randomUUID() })).toThrow('friend');
  });

  it('keeps an edited plan as one record, preserves stock, and refuses stale or completed edits', async () => {
    const { repo, input, initial } = await fixture();
    const gift = await repo.createGift(input);
    const nextInput = { ...input, itemSource: 'inventory' as const, inventoryItemId: initial.inventory[0].id, quantity: 2 };
    const updated = await repo.updateGiftPlan(gift.id, nextInput, gift.updatedAt);
    expect(updated.id).toBe(gift.id);
    expect((await repo.read()).gifts).toHaveLength(1);
    expect((await repo.read()).inventory[0].quantity).toBe(3);
    await expect(repo.updateGiftPlan(gift.id, input, gift.updatedAt)).rejects.toThrow('changed');
    await repo.confirmGift(gift.id);
    await expect(repo.updateGiftPlan(gift.id, input, updated.updatedAt)).rejects.toThrow('no longer editable');
    await repo.cancelGift(gift.id);
    await expect(repo.updateGiftPlan(gift.id, input, updated.updatedAt)).rejects.toThrow('no longer editable');
    expect((await repo.read()).inventory[0].quantity).toBe(3);
  });

  it('captures a wish and keeps it explainable after source edits/deletion without copying private notes', async () => {
    const { repo, input, initial } = await fixture();
    const wish = initial.wishes[0];
    const gift = await repo.createGift({ ...input, wishId: wish.id });
    expect(gift.wishSnapshot).toEqual({ title: wish.title });
    await repo.saveWish({ owner: wish.owner, title: 'Changed wish', note: 'Do not copy me', visibility: 'private', status: 'active' }, wish.id);
    await repo.deleteWish(wish.id);
    const reopened = resolveGiftTask(await repo.read(), { personId: input.personId, planId: gift.id });
    expect(reopened.sources.wishSnapshot?.title).toBe(wish.title);
    const updated = await repo.updateGiftPlan(gift.id, { ...giftInputFromRecord(gift), giftTitle: 'Wrapped gift' }, gift.updatedAt);
    expect(updated.wishSnapshot).toEqual(gift.wishSnapshot);
    await expect(repo.createGift({ ...input, wishId: wish.id })).rejects.toThrow('wish');
    await expect(repo.createGift({ ...input, personId: initial.people[1].id, wishId: initial.wishes[0].id })).rejects.toThrow('wish');
  });

  it('supports legacy suggestions without IDs and freezes the chosen evidence into gift history', async () => {
    const { repo, input, store } = await fixture();
    const run = syntheticRun(input.personId);
    await repo.saveTasteRun(run);
    const key = suggestionKey(run, 0);
    expect(key).toBe('legacy:0');
    const gift = await repo.createGift({ ...input, giftTitle: 'Custom wrapped edition', tasteRunId: run.id, suggestionId: key });
    expect(gift.tasteSnapshot?.evidence[0]).toMatchObject({ score: 0.5, scoreField: 'affinity' });
    const data = await repo.read(); data.tasteRuns = [];
    store.values.set(personalKey, JSON.stringify(data));
    const reopened = await repo.read();
    expect(resolveGiftTask(reopened, { personId: input.personId, planId: gift.id }).sources.tasteSnapshot).toEqual(gift.tasteSnapshot);
    await expect(repo.createGift({ ...input, tasteRunId: run.id, suggestionId: key })).rejects.toThrow('direction');
  });

  it('rejects mismatched source ownership/evidence and can explicitly clear plan sources', async () => {
    const { repo, input, initial } = await fixture();
    const run = syntheticRun(initial.people[1].id);
    await repo.saveTasteRun(run);
    await expect(repo.createGift({ ...input, tasteRunId: run.id, suggestionId: 'legacy:0' })).rejects.toThrow('direction');
    const ownRun = syntheticRun(input.personId); ownRun.suggestions[0].id = 'stable-book';
    await repo.saveTasteRun(ownRun);
    await expect(repo.saveTasteRun({ ...ownRun, qlooEvidence: [] })).rejects.toThrow();
    await expect(repo.saveTasteRun({ ...ownRun, createdAt: '2026-10-25T00:00:00.000Z' })).rejects.toThrow('different evidence');
    const gift = await repo.createGift({ ...input, wishId: initial.wishes[0].id, tasteRunId: ownRun.id, suggestionId: 'stable-book', occasionId: initial.occasions[0].id, occasionDate: '2026-11-08' });
    const cleared = await repo.updateGiftPlan(gift.id, { ...input, note: undefined }, gift.updatedAt);
    expect(cleared).not.toHaveProperty('occasionId');
    expect(cleared).not.toHaveProperty('wishId'); expect(cleared).not.toHaveProperty('wishSnapshot');
    expect(cleared).not.toHaveProperty('tasteRunId'); expect(cleared).not.toHaveProperty('tasteSnapshot');
  });

  it('recognizes the same cultural entity even when the gift is renamed, and allows cancelled directions', async () => {
    const { repo, input } = await fixture();
    const run = syntheticRun(input.personId); await repo.saveTasteRun(run);
    const gift = await repo.createGift({ ...input, giftTitle: 'A custom name', tasteRunId: run.id, suggestionId: 'legacy:0' });
    await repo.confirmGift(gift.id);
    const entities = [{ entityId: 'fixture-book', entityType: 'urn:entity:book', name: 'A renamed edition' }];
    expect(giftDirections(await repo.read(), input.personId, entities)).toEqual([]);
    expect(checkGift(await repo.read(), input.personId, { title: 'Another name', evidenceEntityIds: ['fixture-book'] }).some((r) => r.kind === 'conflict')).toBe(true);
    await repo.cancelGift(gift.id);
    expect(giftDirections(await repo.read(), input.personId, entities)).toHaveLength(1);
  });

  it('invalidates checks for input, stock, friend, wish and gift history changes', async () => {
    const { repo, input, initial } = await fixture();
    const candidate = { title: input.giftTitle, quantity: 1, inventoryItemId: initial.inventory[0].id, price: 20, currency: 'CNY', budget: 50, budgetCurrency: 'CNY' };
    const before = await repo.read(); const key = giftCheckFingerprint(before, input.personId, candidate);
    for (const delta of [{ quantity: 2 }, { price: 60 }, { currency: 'USD' }, { budget: 10 }, { budgetCurrency: 'USD' }, { title: 'Other' }]) {
      expect(giftCheckFingerprint(before, input.personId, { ...candidate, ...delta })).not.toBe(key);
    }
    for (const collection of ['inventory', 'people', 'wishes', 'gifts'] as const) {
      const data = structuredClone(before);
      if (collection === 'inventory') data.inventory[0].quantity = 0;
      if (collection === 'people') data.people[0].dislikes = ['Tea'];
      if (collection === 'wishes') data.wishes[0].title = 'Other';
      if (collection === 'gifts') data.gifts.push(await repo.createGift(input));
      expect(giftCheckFingerprint(data, input.personId, candidate)).not.toBe(key);
    }
    expect(checkGift(before, input.personId, { ...candidate, quantity: 3 }).some((r) => r.kind === 'conflict' && r.message.includes('budget'))).toBe(true);
    expect(checkGift(before, input.personId, { ...candidate, currency: '12', budgetCurrency: '12' }).some((r) => r.kind === 'unknown' && r.message.startsWith('Budget'))).toBe(true);
  });

  it('reads old snapshots without rewriting notes, dates or reminders; backup failure never overwrites them', async () => {
    const { repo, store, initial } = await fixture();
    const raw = store.values.get(personalKey)!;
    expect(await repo.read()).toEqual(initial);
    expect(store.values.get(personalKey)).toBe(raw);
    expect(store.values.has(`${personalKey}-recovery-r1`)).toBe(false);
    store.failKey = `${personalKey}-recovery-r1`;
    await expect(repo.updatePerson(initial.people[0].id, { displayName: 'Changed', interests: [] })).rejects.toThrow('disk');
    expect(store.values.get(personalKey)).toBe(raw);
    store.failKey = undefined;
    await repo.updatePerson(initial.people[0].id, { displayName: 'Changed', interests: [] });
    expect(store.values.get(`${personalKey}-recovery-r1`)).toBe(raw);
    expect(snapshotSchema.parse(JSON.parse(store.values.get(`${personalKey}-recovery-r1`)!))).toEqual(initial);
    await repo.updatePerson(initial.people[0].id, { displayName: 'Changed again', interests: [] });
    expect(store.values.get(`${personalKey}-recovery-r1`)).toBe(raw);
    expect((await repo.read()).occasions).toEqual(initial.occasions);
  });

  it('reads a legacy given record with only note and adds feedback without reinterpreting the note', async () => {
    const { repo, store, initial, input } = await fixture();
    const id = randomUUID();
    initial.gifts.push({ ...input, id, operationId: id, status: 'given', giftedAt: '2026-10-24', createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z' });
    const old = JSON.stringify(initial); store.values.set(personalKey, old);
    expect((await repo.read()).gifts[0]).not.toHaveProperty('feedback');
    expect(store.values.get(personalKey)).toBe(old);
    await repo.updateGiftFeedback(id, 'New independent feedback');
    expect((await repo.read()).gifts[0]).toMatchObject({ note: input.note, feedback: 'New independent feedback' });
    expect(store.values.get(`${personalKey}-recovery-r1`)).toBe(old);
  });

  it('treats omitted/default birthday reminders as the same request and rejects reminders without a date', async () => {
    const { repo } = await fixture(); const id = randomUUID();
    await repo.addPerson({ displayName: 'Default retry', monthDay: '12-31' }, id);
    await repo.addPerson({ displayName: 'Default retry', monthDay: '12-31', reminderDaysBefore: [30, 30] }, id);
    await expect(repo.addPerson({ displayName: 'No date', reminderDaysBefore: [60] })).rejects.toThrow('birthday');
    const nameOnlyId = randomUUID();
    await repo.addPerson({ displayName: 'Name only' }, nameOnlyId);
    await repo.addPerson({ displayName: 'Name only' }, nameOnlyId);
    expect((await repo.read()).people.filter((person) => person.id === nameOnlyId)).toHaveLength(1);
  });
});
