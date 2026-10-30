import type { GiftInput, Snapshot } from './schemas';
import { normalizedGiftTitle, previouslyGiven } from './gift-sources';

// R3 local decision module. Pure and testable: it ranks what the user already
// recorded (active wishes, non-zero stock, avoids, gift history) into explicit
// candidates with sources, without any Qloo call and without inventing
// preferences. A relationship or occasion never implies a liking.

export type CandidateStatus = 'ready' | 'needs-review';
export type LocalCandidate = {
  id: string;
  kind: 'wish' | 'wish-with-stock' | 'inventory';
  title: string;
  wishId?: string;
  inventoryItemId?: string;
  quantityAvailable?: number;
  unitCost?: number;
  currency?: string;
  status: CandidateStatus;
  facts: string[];
  cautions: string[];
  unknowns: string[];
};

export type DecisionSummary = {
  personName: string;
  activeWishes: string[];
  avoids: string[];
  givenTitles: string[];
  stockCount: number;
  recordedInterests: string[];
};

export function decisionSummary(snapshot: Snapshot, personId: string): DecisionSummary {
  const person = snapshot.people.find((entry) => entry.id === personId);
  if (!person) throw new Error('Choose a saved friend.');
  return {
    personName: person.displayName,
    activeWishes: snapshot.wishes.filter((wish) => wish.owner.kind === 'person' && wish.owner.personId === personId && wish.status === 'active').map((wish) => wish.title),
    avoids: person.dislikes ?? [],
    givenTitles: snapshot.gifts.filter((gift) => gift.personId === personId && gift.status === 'given').map((gift) => gift.giftTitle),
    stockCount: snapshot.inventory.filter((item) => item.quantity > 0).length,
    recordedInterests: person.interests.map((interest) => interest.label),
  };
}

export function localCandidates(snapshot: Snapshot, personId: string): LocalCandidate[] {
  const person = snapshot.people.find((entry) => entry.id === personId);
  if (!person) throw new Error('Choose a saved friend.');
  const avoids = person.dislikes ?? [];
  const cautionFor = (title: string) => {
    const hits = avoids.filter((word) => title.toLocaleLowerCase().includes(word.toLocaleLowerCase()));
    return hits.length ? [`Title contains a recorded avoid: ${hits.join(', ')}.`] : [];
  };
  const candidates: LocalCandidate[] = [];
  const matchedStock = new Set<string>();
  for (const wish of snapshot.wishes.filter((wish) => wish.owner.kind === 'person' && wish.owner.personId === personId && wish.status === 'active')) {
    const stock = snapshot.inventory.find((item) => item.quantity > 0 && normalizedGiftTitle(item.title) === normalizedGiftTitle(wish.title));
    const given = previouslyGiven(snapshot, personId, wish.title, [], stock?.id);
    const cautions = [
      ...given.length ? [`A matching gift was already given ${given.length} time(s).`] : [],
      ...cautionFor(wish.title),
    ];
    if (stock) matchedStock.add(stock.id);
    candidates.push({
      id: `wish:${wish.id}`, kind: stock ? 'wish-with-stock' : 'wish', title: wish.title,
      wishId: wish.id, inventoryItemId: stock?.id, quantityAvailable: stock?.quantity,
      unitCost: stock?.unitCost, currency: stock?.currency,
      status: cautions.length ? 'needs-review' : 'ready',
      facts: ['An active wish you recorded for them.', ...(stock ? [`${stock.quantity} of a matching item in your gift box.`] : [])],
      cautions,
      unknowns: stock?.unitCost === undefined ? ['No price is recorded; budget fit stays unknown until you enter one.'] : [],
    });
  }
  for (const item of snapshot.inventory.filter((entry) => entry.quantity > 0 && !matchedStock.has(entry.id))) {
    const given = previouslyGiven(snapshot, personId, item.title, [], item.id);
    const cautions = [
      ...given.length ? [`This stock item was already given ${given.length} time(s).`] : [],
      ...cautionFor(item.title),
    ];
    candidates.push({
      id: `stock:${item.id}`, kind: 'inventory', title: item.title,
      inventoryItemId: item.id, quantityAvailable: item.quantity,
      unitCost: item.unitCost, currency: item.currency,
      status: cautions.length ? 'needs-review' : 'ready',
      facts: [`${item.quantity} available in your gift box.`],
      cautions,
      unknowns: item.unitCost === undefined ? ['No price is recorded; budget fit stays unknown until you enter one.'] : [],
    });
  }
  return candidates;
}

// Selecting a recorded candidate is a manual choice: it clears any stale
// exploration reference instead of mixing sources.
export function candidateToGiftInput(candidate: LocalCandidate, base: GiftInput): GiftInput {
  const rest = { ...base };
  delete rest.tasteRunId; delete rest.suggestionId;
  return {
    ...rest, giftTitle: candidate.title,
    itemSource: candidate.inventoryItemId ? 'inventory' : 'external',
    inventoryItemId: candidate.inventoryItemId, quantity: 1,
    wishId: candidate.wishId,
  };
}

export type ExploreReadiness = { ok: true } | { ok: false; reason: 'no-signals' | 'too-many'; hint: string };
export function exploreReadiness(recordedInterests: string[], signals: string[]): ExploreReadiness {
  const cleaned = [...new Set(signals.map((entry) => entry.trim()).filter(Boolean))];
  if (!cleaned.length) return { ok: false, reason: 'no-signals', hint: recordedInterests.length
    ? 'Pick at least one recorded cultural interest, or type a public artist, work or brand.'
    : 'No cultural interests are recorded for this friend yet. Add interests on their profile, or type a public artist, work or brand below.' };
  if (cleaned.length > 3) return { ok: false, reason: 'too-many', hint: 'Use at most three clear cultural interests in one exploration.' };
  return { ok: true };
}
