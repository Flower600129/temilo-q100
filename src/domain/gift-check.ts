import type { Snapshot } from './schemas';
import { previouslyGiven } from './gift-sources';
export type GiftCheck = { kind: 'known' | 'conflict' | 'unknown'; message: string };
export type GiftCandidate = { title: string; inventoryItemId?: string; quantity?: number; evidenceEntityIds?: string[]; price?: number; currency?: string; budget?: number; budgetCurrency?: string };
export const giftCheckFingerprint = (snapshot: Snapshot, personId: string, candidate: GiftCandidate) => JSON.stringify({
  candidate, person: snapshot.people.find((entry) => entry.id === personId),
  inventory: snapshot.inventory.find((entry) => entry.id === candidate.inventoryItemId),
  wishes: snapshot.wishes.filter((entry) => entry.owner.kind === 'person' && entry.owner.personId === personId),
  gifts: snapshot.gifts.filter((entry) => entry.personId === personId),
});
export function checkGift(snapshot: Snapshot, personId: string, candidate: GiftCandidate): GiftCheck[] {
  const person = snapshot.people.find((entry) => entry.id === personId);
  if (!person) throw new Error('Choose a saved friend.');
  const title = candidate.title.trim().toLocaleLowerCase();
  if (!title) throw new Error('Enter a candidate gift.');
  const result: GiftCheck[] = [];
  const avoids = person.dislikes?.filter((entry) => title.includes(entry.toLocaleLowerCase())) ?? [];
  if (avoids.length) result.push({ kind: 'conflict', message: `Title contains an avoid keyword: ${avoids.join(', ')}.` });
  else result.push({ kind: 'unknown', message: person.dislikes?.length ? `No direct title match for avoid keywords (${person.dislikes.join(', ')}). Check the actual contents yourself.` : 'No dislikes are recorded. Suitability is unknown.' });
  const previous = previouslyGiven(snapshot, personId, title, candidate.evidenceEntityIds, candidate.inventoryItemId);
  if (previous.length) result.push({ kind: 'conflict', message: `A matching title, stock item or cultural direction was already given ${previous.length} time(s).` });
  else result.push({ kind: 'known', message: 'No matching title, stock item or cultural direction in this friend’s completed gift records.' });
  const wish = snapshot.wishes.find((entry) => entry.owner.kind === 'person' && entry.owner.personId === personId && entry.status === 'active' && entry.title.toLocaleLowerCase() === title);
  if (wish) result.push({ kind: 'known', message: 'This title matches an active wish you recorded for them.' });
  else result.push({ kind: 'unknown', message: 'This candidate is not an exact match to a recorded active wish.' });
  if (candidate.inventoryItemId) {
    const item = snapshot.inventory.find((entry) => entry.id === candidate.inventoryItemId);
    const quantity = candidate.quantity ?? 1;
    result.push(item && Number.isInteger(quantity) && quantity > 0 && item.quantity >= quantity ? { kind: 'known', message: `${item.quantity} available in your gift box. Stock is checked again when given.` } : { kind: 'conflict', message: 'This inventory item has insufficient stock for the requested quantity.' });
  }
  const amounts = [candidate.price, candidate.budget];
  const quantity = candidate.quantity ?? 1;
  if (Number.isInteger(quantity) && quantity > 0 && amounts.every((amount) => amount !== undefined && Number.isFinite(amount) && amount >= 0) && /^[A-Z]{3}$/.test(candidate.currency ?? '') && candidate.currency === candidate.budgetCurrency) {
    result.push(candidate.price! * (candidate.quantity ?? 1) <= candidate.budget! ? { kind: 'known', message: 'Within your entered budget, using your entered price, quantity and currency.' } : { kind: 'conflict', message: 'The entered total price exceeds the budget.' });
  } else result.push({ kind: 'unknown', message: 'Budget fit is unverified without a price and budget in the same currency.' });
  result.push({ kind: 'unknown', message: 'Personal preference, product contents, current price and real-world availability are not verified by this check.' });
  return result;
}
