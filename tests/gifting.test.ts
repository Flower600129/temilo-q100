import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SnapshotRepository, type KeyValueStore } from '../src/domain/snapshot-repository';
import { emptySnapshot, snapshotSchema, type GiftInput } from '../src/domain/schemas';
import { checkGift } from '../src/domain/gift-check';
import { upcomingOccasions } from '../src/domain/upcoming';
class Store implements KeyValueStore {
  values = new Map<string, string>(); fail = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { if (this.fail) { this.fail = false; throw new Error('Disk full'); } this.values.set(key, value); }
}
async function setup(quantity = 3) {
  const store = new Store(); const repo = new SnapshotRepository('personal', store, randomUUID);
  const person = await repo.addPerson({ displayName: 'Alex', monthDay: '10-01', reminderDaysBefore: [60] });
  const item = await repo.saveInventory({ title: 'Tea set', quantity, unitCost: 20, currency: 'CNY' });
  const input: GiftInput = { personId: person.id, giftTitle: item.title, itemSource: 'inventory', inventoryItemId: item.id, quantity: 1 };
  return { store, repo, person, item, input };
}
describe('real local gift lifecycle', () => {
  it('creates a plan without reserving stock, confirms twice once, cancels twice once', async () => {
    const { repo, input } = await setup(); const operationId = randomUUID();
    const [a, b] = await Promise.all([repo.createGift(input, operationId), repo.createGift(input, operationId)]);
    expect(a.id).toBe(b.id); expect((await repo.read()).inventory[0].quantity).toBe(3);
    await Promise.all([repo.confirmGift(a.id), repo.confirmGift(a.id)]);
    expect((await repo.read()).gifts).toHaveLength(1); expect((await repo.read()).inventory[0].quantity).toBe(2);
    await Promise.all([repo.cancelGift(a.id), repo.cancelGift(a.id)]);
    expect((await repo.read()).inventory[0].quantity).toBe(3);
    await expect(repo.confirmGift(a.id)).rejects.toThrow('cancelled');
  });
  it('rejects operation ID reuse with different payload', async () => {
    const { repo, input } = await setup(); const id = randomUUID(); await repo.createGift(input, id);
    await expect(repo.createGift({ ...input, quantity: 2 }, id)).rejects.toThrow('different gift data');
  });
  it('serializes competing stock submissions and keeps quantity nonnegative', async () => {
    const { repo, input } = await setup(1); const a = await repo.createGift(input); const b = await repo.createGift(input);
    const settled = await Promise.allSettled([repo.confirmGift(a.id), repo.confirmGift(b.id)]);
    expect(settled.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    const data = await repo.read(); expect(data.inventory[0].quantity).toBe(0); expect(data.gifts.filter((gift) => gift.status === 'given')).toHaveLength(1);
    await expect(repo.confirmGift(data.gifts.find((gift) => gift.status === 'planned')!.id)).rejects.toThrow('Not enough stock');
  });
  it('restores only given inventory gifts; plans, external gifts and experiences never change stock', async () => {
    const { repo, input } = await setup(); const plan = await repo.createGift(input); await repo.cancelGift(plan.id);
    for (const itemSource of ['external', 'experience'] as const) {
      const gift = await repo.createGift({ ...input, itemSource, inventoryItemId: undefined }); await repo.confirmGift(gift.id); await repo.cancelGift(gift.id);
    }
    expect((await repo.read()).inventory[0].quantity).toBe(3);
  });
  it('does not persist deductions, records or restorations on failed writes', async () => {
    const { repo, store, input } = await setup(); const gift = await repo.createGift(input); const before = await repo.read();
    store.fail = true; await expect(repo.confirmGift(gift.id)).rejects.toThrow('Disk full'); expect(await repo.read()).toEqual(before);
    await repo.confirmGift(gift.id); const given = await repo.read(); store.fail = true;
    await expect(repo.cancelGift(gift.id)).rejects.toThrow('Disk full'); expect(await repo.read()).toEqual(given);
  });
  it('rejects invalid stock / source / dates / references and preserves the previous snapshot', async () => {
    const { repo, input } = await setup(); const before = await repo.read();
    await expect(repo.saveInventory({ title: 'Invalid', quantity: -1 })).rejects.toThrow();
    await expect(repo.saveInventory({ title: 'Invalid', quantity: 0.5 })).rejects.toThrow();
    await expect(repo.saveInventory({ title: 'Invalid', quantity: 1, unitCost: 1 })).rejects.toThrow();
    await expect(repo.createGift({ ...input, inventoryItemId: undefined })).rejects.toThrow();
    await expect(repo.createGift({ ...input, personId: randomUUID() })).rejects.toThrow();
    expect(await repo.read()).toEqual(before);
    const gift = await repo.createGift(input); await expect(repo.confirmGift(gift.id, '2026-02-30')).rejects.toThrow(); expect((await repo.read()).inventory[0].quantity).toBe(3);
  });
  it('blocks stale stock edits and linked inventory deletion, preserves annual occurrence year', async () => {
    const { repo, input, item } = await setup(); const occasion = (await repo.read()).occasions[0];
    const gift = await repo.createGift({ ...input, occasionId: occasion.id, occasionDate: '2027-10-01' }); await repo.confirmGift(gift.id);
    await expect(repo.saveInventory({ title: item.title, quantity: 5 }, item.id, item.updatedAt)).rejects.toThrow('changed');
    await expect(repo.deleteInventory(item.id)).rejects.toThrow('gift records');
    expect((await repo.read()).gifts[0].occasionDate).toBe('2027-10-01');
  });
  it('saves gift feedback without touching inventory and keeps all data through reopening', async () => {
    const { repo, store, input } = await setup(); const gift = await repo.createGift(input); await repo.confirmGift(gift.id); await repo.updateGiftFeedback(gift.id, 'Loved the tea.');
    const reopened = new SnapshotRepository('personal', store, randomUUID); const data = await reopened.read();
    expect(data.gifts[0].feedback).toBe('Loved the tea.'); expect(data.gifts[0].note).toBeUndefined(); expect(data.inventory[0].quantity).toBe(2);
  });
});
describe('wish management and preparation windows', () => {
  it('updates, fulfills, archives and deletes a wish while rejecting orphan owners', async () => {
    const { repo, person } = await setup(); const wish = await repo.saveWish({ owner: { kind: 'person', personId: person.id }, title: 'A book', status: 'active', visibility: 'private' });
    await repo.saveWish({ ...wishInput(wish), title: 'A special book', status: 'fulfilled' }, wish.id);
    expect((await repo.read()).wishes[0].title).toBe('A special book');
    await expect(repo.saveWish({ ...wishInput(wish), owner: { kind: 'person', personId: randomUUID() } }, wish.id)).rejects.toThrow();
    expect((await repo.read()).wishes[0].status).toBe('fulfilled'); await repo.deleteWish(wish.id); expect((await repo.read()).wishes).toEqual([]);
  });
  it('shows a birthday throughout its configured window, including missed reminder nodes and cross-month dates', async () => {
    const { repo } = await setup(); const data = await repo.read();
    expect(upcomingOccasions(data, new Date(2026, 7, 1))[0].inPreparationWindow).toBe(false);
    expect(upcomingOccasions(data, new Date(2026, 7, 2))[0]).toMatchObject({ days: 60, inPreparationWindow: true, reminderDue: true });
    expect(upcomingOccasions(data, new Date(2026, 7, 5))[0]).toMatchObject({ days: 57, inPreparationWindow: true, reminderDue: false });
    expect(upcomingOccasions(data, new Date(2026, 9, 1))[0]).toMatchObject({ days: 0, inPreparationWindow: true });
    expect(upcomingOccasions(data, new Date(2026, 9, 2))[0].inPreparationWindow).toBe(false);
    data.occasions[0].monthDay = '01-01'; expect(upcomingOccasions(data, new Date(2026, 11, 20))[0].inPreparationWindow).toBe(true);
    data.occasions[0].reminderDaysBefore = []; expect(upcomingOccasions(data, new Date(2026, 11, 20))[0].inPreparationWindow).toBe(false);
  });
  it('adds new default 30-day reminders without rewriting saved old settings', async () => {
    const { repo, person } = await setup(); await repo.addPerson({ displayName: 'New', monthDay: '11-20' });
    const data = await repo.read(); expect(data.occasions.find((o) => o.personId === person.id)?.reminderDaysBefore).toEqual([60]);
    expect(data.occasions.find((o) => o.personId !== person.id)?.reminderDaysBefore).toEqual([30]);
    expect(snapshotSchema.parse({ ...emptySnapshot(), ...data })).toEqual(data);
  });
  it('reports only verifiable local checks and never invents budget fit or a liking score', async () => {
    const { repo, input, person } = await setup(); await repo.updatePerson(person.id, { displayName: 'Alex', interests: [], dislikes: ['perfume'] });
    const given = await repo.createGift(input); await repo.confirmGift(given.id);
    expect(checkGift(await repo.read(), person.id, { title: 'Tea set' }).some((r) => r.kind === 'conflict' && r.message.includes('already given'))).toBe(true);
    expect(checkGift(await repo.read(), person.id, { title: 'Perfume', price: 10, currency: 'USD', budget: 100, budgetCurrency: 'CNY' }).some((r) => r.kind === 'unknown' && r.message.includes('Budget'))).toBe(true);
    expect(checkGift(await repo.read(), person.id, { title: 'Perfume' }).some((r) => r.kind === 'conflict' && r.message.includes('avoid'))).toBe(true);
  });
});
function wishInput(wish: { owner: unknown; title: string; status: string; visibility: string }) { return { owner: wish.owner, title: wish.title, status: wish.status, visibility: wish.visibility }; }
