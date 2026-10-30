import { z } from 'zod';
import { giftInputFromRecord, selectedSources } from './gift-sources';
import { isoDateSchema, type GiftInput, type Snapshot } from './schemas';
import { localDateKey, nextBirthday } from './dates';
import { upcomingOccasions } from './upcoming';

export const giftContextSchema = z.object({
  personId: z.uuid(), occasionId: z.uuid().optional(), occasionDate: isoDateSchema.optional(),
  planId: z.uuid().optional(), wishId: z.uuid().optional(), tasteRunId: z.uuid().optional(),
  suggestionId: z.string().min(1).max(200).optional(), draftId: z.uuid().optional(),
}).strict();
export type GiftContext = z.infer<typeof giftContextSchema>;
export type GiftDraft = { input: GiftInput; planId?: string; expectedUpdatedAt?: string; check?: { price: string; currency: string; budget: string; budgetCurrency: string } };

export function readGiftContext(params: Record<string, unknown>): GiftContext {
  const parsed = giftContextSchema.safeParse(Object.fromEntries(Object.keys(giftContextSchema.shape).flatMap((key) => params[key] === undefined ? [] : [[key, params[key]]])));
  if (!parsed.success) throw new Error('This gift link is invalid. Reopen it from the friend or saved plan.');
  return parsed.data;
}

// Only IDs and the concrete occasion date travel in navigation. Gift titles,
// notes, checks and evidence remain in the local transient draft or saved record.
export function giftContextFor(input: GiftInput, extra: Pick<GiftContext, 'planId' | 'draftId'> = {}): GiftContext {
  const { personId, occasionId, occasionDate, wishId, tasteRunId, suggestionId } = input;
  return giftContextSchema.parse({ personId, occasionId, occasionDate, wishId, tasteRunId, suggestionId, ...extra });
}

export function validateOccasionDate(snapshot: Snapshot, personId: string, occasionId?: string, date?: string) {
  if (!occasionId) {
    if (date) throw new Error('A preparation date needs its occasion.');
    return;
  }
  const occasion = snapshot.occasions.find((entry) => entry.id === occasionId && entry.personId === personId);
  if (!occasion) throw new Error('This occasion is no longer available for this friend.');
  if (date) {
    isoDateSchema.parse(date);
    const expected = occasion.recurrence === 'once' ? `${occasion.year}-${occasion.monthDay}`
      : localDateKey(nextBirthday(occasion.monthDay, new Date(Number(date.slice(0, 4)), 0, 1)).date);
    if (date !== expected) throw new Error('This occasion date changed. Review the occasion before continuing.');
  }
}

export function resolveGiftTask(snapshot: Snapshot, context: GiftContext, draft?: GiftDraft, today = new Date()) {
  if (!snapshot.people.some((person) => person.id === context.personId)) throw new Error('This friend is no longer available.');
  if (context.draftId && !draft) throw new Error('This unsaved draft has expired. Reopen a saved plan or start a new one.');
  if (draft && (draft.input.personId !== context.personId || draft.planId !== context.planId)) throw new Error('This draft belongs to another gift task.');
  const plan = context.planId ? snapshot.gifts.find((gift) => gift.id === context.planId && gift.personId === context.personId) : undefined;
  if (context.planId && !plan) throw new Error('This gift record is no longer available for this friend.');
  const input: GiftInput = draft ? { ...draft.input } : plan ? giftInputFromRecord(plan)
    : { personId: context.personId, itemSource: 'external', quantity: 1, giftTitle: '' };
  if (!draft) {
    for (const key of ['occasionId', 'occasionDate', 'wishId', 'tasteRunId', 'suggestionId'] as const) if (context[key] !== undefined) input[key] = context[key];
  }
  if (input.occasionId && !input.occasionDate) {
    const occasion = snapshot.occasions.find((entry) => entry.id === input.occasionId);
    const next = upcomingOccasions(snapshot, today).find((entry) => entry.occasion.id === input.occasionId);
    input.occasionDate = next ? localDateKey(next.date) : occasion?.recurrence === 'once' ? `${occasion.year}-${occasion.monthDay}` : undefined;
  }
  validateOccasionDate(snapshot, input.personId, input.occasionId, input.occasionDate);
  const sources = selectedSources(snapshot, input, plan);
  if (!draft && !plan) input.giftTitle = sources.tasteSnapshot?.suggestion.title ?? sources.wishSnapshot?.title ?? '';
  if (input.itemSource === 'inventory' && !snapshot.inventory.some((entry) => entry.id === input.inventoryItemId)) throw new Error('This inventory item is no longer available.');
  return { input, planId: plan?.id, expectedUpdatedAt: draft?.expectedUpdatedAt ?? plan?.updatedAt, sources, check: draft?.check, readOnly: Boolean(plan && plan.status !== 'planned') };
}
