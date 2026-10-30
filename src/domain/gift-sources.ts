import { giftInputSchema, type GiftInput, type GiftRecord, type Snapshot, type TasteRun } from './schemas';

export const suggestionKey = (run: TasteRun, index: number) => run.suggestions[index]?.id ?? `legacy:${index}`;
export const normalizedGiftTitle = (title: string) => title.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

export function giftInputFromRecord(gift: GiftRecord): GiftInput {
  const { personId, occasionId, occasionDate, itemSource, inventoryItemId, quantity, giftTitle, note, wishId, tasteRunId, suggestionId } = gift;
  return giftInputSchema.parse({ personId, occasionId, occasionDate, itemSource, inventoryItemId, quantity, giftTitle, note, wishId, tasteRunId, suggestionId });
}

// Freeze only the selected source's relevant facts. They remain readable if a
// wish is later edited/deleted; private wish notes are not copied into URLs/APIs.
export function selectedSources(snapshot: Snapshot, input: GiftInput, previous?: GiftRecord) {
  let wishSnapshot: GiftRecord['wishSnapshot'];
  let tasteSnapshot: GiftRecord['tasteSnapshot'];
  if (input.wishId) {
    if (previous?.personId === input.personId && previous.wishId === input.wishId && previous.wishSnapshot) wishSnapshot = previous.wishSnapshot;
    else {
      const wish = snapshot.wishes.find((entry) => entry.id === input.wishId);
      if (!wish || wish.owner.kind !== 'person' || wish.owner.personId !== input.personId) throw new Error('This wish is no longer available for this friend. Review the source before saving.');
      wishSnapshot = { title: wish.title, sourceUrl: wish.sourceUrl };
    }
  }
  if (input.tasteRunId) {
    if (previous?.personId === input.personId && previous.tasteRunId === input.tasteRunId && previous.suggestionId === input.suggestionId && previous.tasteSnapshot) tasteSnapshot = previous.tasteSnapshot;
    else {
      const run = snapshot.tasteRuns.find((entry) => entry.id === input.tasteRunId);
      const index = run?.suggestions.findIndex((_, i) => suggestionKey(run, i) === input.suggestionId) ?? -1;
      if (!run || run.personId !== input.personId || index < 0) throw new Error('This saved direction is no longer available for this friend.');
      const suggestion = run.suggestions[index];
      // Freeze both the selected direction and confirmed source entities.
      // Type remains on every entry, including source/target ID collisions.
      tasteSnapshot = { suggestion, evidence: run.qlooEvidence.filter((entry) => suggestion.evidenceEntityIds.includes(entry.entityId) || run.inputSignals.some((signal) => signal.qlooEntityId === entry.entityId && (!signal.qlooEntityType || signal.qlooEntityType === entry.entityType))) };
    }
  }
  return JSON.parse(JSON.stringify({ wishSnapshot, tasteSnapshot })) as Pick<GiftRecord, 'wishSnapshot' | 'tasteSnapshot'>;
}

export function previouslyGiven(snapshot: Snapshot, personId: string, title: string, evidenceIds: string[] = [], inventoryItemId?: string) {
  const ids = new Set(evidenceIds.map((id) => id.toLowerCase()));
  return snapshot.gifts.filter((gift) => gift.personId === personId && gift.status === 'given' && (
    normalizedGiftTitle(gift.giftTitle) === normalizedGiftTitle(title) ||
    inventoryItemId && gift.inventoryItemId === inventoryItemId ||
    gift.tasteSnapshot?.suggestion.evidenceEntityIds.some((id) => ids.has(id.toLowerCase()))
  ));
}
