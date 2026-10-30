import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { candidateToGiftInput, decisionSummary, exploreReadiness, localCandidates } from '../src/domain/gift-decision';
import { entityKey, uniqueEntities } from '../src/domain/gift-ideas';
import { emptySnapshot, type GiftInput, type Snapshot } from '../src/domain/schemas';

// Synthetic fixtures only: these test the local decision module and never
// stand in for a Qloo HTTP response.
function base(): Snapshot {
  return structuredClone(emptySnapshot());
}
const stamp = '2026-10-24T00:00:00.000Z';
function person(snapshot: Snapshot, overrides: Partial<Snapshot['people'][number]> = {}) {
  const entry = { id: randomUUID(), displayName: 'Test friend', interests: [], createdAt: stamp, updatedAt: stamp, ...overrides };
  snapshot.people.push(entry);
  return entry;
}
function wish(snapshot: Snapshot, personId: string, title: string) {
  const entry = { id: randomUUID(), owner: { kind: 'person' as const, personId }, title, status: 'active' as const, visibility: 'private' as const, createdAt: stamp, updatedAt: stamp };
  snapshot.wishes.push(entry);
  return entry;
}
function stock(snapshot: Snapshot, title: string, quantity: number, extra: Partial<Snapshot['inventory'][number]> = {}) {
  const entry = { id: randomUUID(), title, quantity, createdAt: stamp, updatedAt: stamp, ...extra };
  snapshot.inventory.push(entry);
  return entry;
}
function givenGift(snapshot: Snapshot, personId: string, title: string, extra: Partial<Snapshot['gifts'][number]> = {}) {
  const id = randomUUID();
  const entry = { id, operationId: id, personId, itemSource: 'external' as const, quantity: 1, giftTitle: title, status: 'given' as const, giftedAt: '2026-01-10', createdAt: stamp, updatedAt: stamp, ...extra };
  snapshot.gifts.push(entry);
  return entry;
}

describe('local decision candidates', () => {
  it('ranks an active wish first and merges matching stock into one candidate', () => {
    const snapshot = base();
    const friend = person(snapshot);
    stock(snapshot, 'Unrelated stock item', 2);
    const item = stock(snapshot, 'Artisan tea set', 3);
    wish(snapshot, friend.id, 'artisan tea set');
    const candidates = localCandidates(snapshot, friend.id);
    expect(candidates[0]).toMatchObject({ kind: 'wish-with-stock', title: 'artisan tea set', wishId: snapshot.wishes[0].id, inventoryItemId: item.id, quantityAvailable: 3, status: 'ready' });
    expect(candidates[0].facts).toContain('An active wish you recorded for them.');
    expect(candidates.filter((candidate) => candidate.inventoryItemId === item.id)).toHaveLength(1);
    expect(candidates[1]).toMatchObject({ kind: 'inventory', title: 'Unrelated stock item', status: 'ready' });
  });

  it('flags avoids, duplicate history and missing prices instead of hiding or fabricating', () => {
    const snapshot = base();
    const friend = person(snapshot, { dislikes: ['Tea'] });
    const tea = stock(snapshot, 'Tea sampler', 2);
    wish(snapshot, friend.id, 'Tea sampler');
    stock(snapshot, 'Silk scarf', 1, { unitCost: 30, currency: 'CNY' });
    const candidates = localCandidates(snapshot, friend.id);
    expect(candidates.find((candidate) => candidate.inventoryItemId === tea.id)).toMatchObject({ status: 'needs-review' });
    expect(candidates.find((candidate) => candidate.inventoryItemId === tea.id)!.cautions[0]).toContain('avoid');
    expect(candidates.find((candidate) => candidate.inventoryItemId === tea.id)!.unknowns[0]).toContain('budget fit stays unknown');
    const scarf = candidates.find((candidate) => candidate.title === 'Silk scarf')!;
    expect(scarf.status).toBe('ready');
    expect(scarf.unknowns).toEqual([]);
    expect(scarf.unitCost).toBe(30);
  });

  it('excludes zero stock and marks stock already given as needs-review', () => {
    const snapshot = base();
    const friend = person(snapshot);
    stock(snapshot, 'Empty box', 0);
    const given = stock(snapshot, 'Candle set', 2);
    givenGift(snapshot, friend.id, 'A wrapped candle set', { itemSource: 'inventory', inventoryItemId: given.id });
    const candidates = localCandidates(snapshot, friend.id);
    expect(candidates.find((candidate) => candidate.title === 'Empty box')).toBeUndefined();
    expect(candidates.find((candidate) => candidate.inventoryItemId === given.id)).toMatchObject({ status: 'needs-review' });
  });

  it('summarizes recorded facts without inferring preferences', () => {
    const snapshot = base();
    const friend = person(snapshot, { relationship: 'Colleague', interests: [{ label: 'Jazz' }], dislikes: ['Mugs'] });
    wish(snapshot, friend.id, 'A live jazz evening');
    stock(snapshot, 'Mug', 1);
    givenGift(snapshot, friend.id, 'Last year scarf');
    const summary = decisionSummary(snapshot, friend.id);
    expect(summary).toMatchObject({ personName: 'Test friend', activeWishes: ['A live jazz evening'], avoids: ['Mugs'], givenTitles: ['Last year scarf'], stockCount: 1, recordedInterests: ['Jazz'] });
    expect(localCandidates(snapshot, friend.id).every((candidate) => candidate.facts.length)).toBe(true);
  });

  it('maps a candidate to a manual gift input that clears stale exploration sources', () => {
    const snapshot = base();
    const friend = person(snapshot);
    const item = stock(snapshot, 'Artisan tea set', 3);
    wish(snapshot, friend.id, 'Artisan tea set');
    const baseInput: GiftInput = { personId: friend.id, occasionId: 'occasion-context', occasionDate: '2026-11-08', itemSource: 'external', quantity: 2, giftTitle: 'Old title', tasteRunId: 'run-id', suggestionId: 'suggestion-id' };
    const next = candidateToGiftInput(localCandidates(snapshot, friend.id)[0], baseInput);
    expect(next).toMatchObject({ personId: friend.id, occasionId: 'occasion-context', occasionDate: '2026-11-08', itemSource: 'inventory', inventoryItemId: item.id, quantity: 1, giftTitle: 'Artisan tea set', wishId: snapshot.wishes[0].id });
    expect(next).not.toHaveProperty('tasteRunId');
    expect(next).not.toHaveProperty('suggestionId');
  });

  it('requires explicit cultural signals before any exploration and caps them at three', () => {
    expect(exploreReadiness(['Jazz', 'Film noir'], [])).toEqual({ ok: false, reason: 'no-signals', hint: expect.stringContaining('Pick at least one recorded cultural interest') });
    const none = exploreReadiness([], []);
    expect(none).toMatchObject({ ok: false, reason: 'no-signals' });
    expect((none as { hint: string }).hint).toContain('No cultural interests are recorded');
    expect(exploreReadiness([], ['Jazz'])).toEqual({ ok: true });
    expect(exploreReadiness([], ['Jazz', 'Jazz', 'Film'])).toEqual({ ok: true });
    expect(exploreReadiness([], ['Jazz', 'Film', 'Pottery', 'Cycling'])).toMatchObject({ ok: false, reason: 'too-many' });
  });

  it('keeps same-ID entities of different categories separately selectable', () => {
    const sharedId = '00000000-0000-4000-8000-0000000000aa';
    const book = { entityId: sharedId, entityType: 'urn:entity:book', name: 'Shared name' };
    const artist = { entityId: sharedId, entityType: 'urn:entity:artist', name: 'Shared name' };
    expect(entityKey(book)).not.toBe(entityKey(artist));
    expect(uniqueEntities([book, artist])).toHaveLength(2);
    expect(uniqueEntities([book, { ...book }])).toHaveLength(1);
  });
});
