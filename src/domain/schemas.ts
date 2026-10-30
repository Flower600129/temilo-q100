import { z } from 'zod';
import { validMonthDay } from './dates';

const id = z.uuid();
const text = z.string().trim().min(1).max(200);
const note = z.string().max(2000).optional();
const timestamp = z.iso.datetime();
const dates = { createdAt: timestamp, updatedAt: timestamp };
const monthDay = z.string().refine((value) => validMonthDay(value), 'Choose a valid month and day.');
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number(value.slice(0, 4)) >= 1900 && validMonthDay(value.slice(5), Number(value.slice(0, 4))));
const isoDate = isoDateSchema;
const url = z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an http or https URL.');

export const personSchema = z.object({
  id, displayName: text.max(80), relationship: text.optional(),
  interests: z.array(z.object({ label: text, entityId: z.string().min(1).optional(), entityType: z.string().optional() }).strict()).max(30),
  dislikes: z.array(text).max(30).optional(), notes: note, ...dates,
}).strict();

export const occasionSchema = z.object({
  id, personId: id, type: z.enum(['birthday', 'anniversary', 'other']), label: text,
  monthDay, year: z.number().int().min(1900).max(9999).optional(),
  recurrence: z.enum(['annual', 'once']), reminderDaysBefore: z.array(z.number().int().min(0).max(365)).max(20),
}).strict().superRefine((value, ctx) => {
  if (value.recurrence === 'once' && (value.year === undefined || !validMonthDay(value.monthDay, value.year))) {
    ctx.addIssue({ code: 'custom', path: ['year'], message: 'A one-time occasion needs a valid complete date.' });
  }
});

export const wishSchema = z.object({
  id, owner: z.discriminatedUnion('kind', [z.object({ kind: z.literal('self') }).strict(), z.object({ kind: z.literal('person'), personId: id }).strict()]),
  title: text, sourceUrl: url.optional(), note, status: z.enum(['active', 'fulfilled', 'archived']),
  visibility: z.literal('private'), ...dates,
}).strict();

export const inventoryItemSchema = z.object({
  id, title: text, category: text.optional(), quantity: z.number().int().nonnegative(),
  location: text.optional(), description: note, currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  unitCost: z.number().finite().nonnegative().optional(), ...dates,
}).strict().refine((value) => value.unitCost === undefined || value.currency !== undefined, 'Cost needs a currency.');

export const evidenceSchema = z.object({
  entityId: z.string().min(1), entityType: z.string().optional(), name: z.string().optional(),
  relationship: z.string().optional(), score: z.number().finite().optional(),
  scoreField: z.string().optional(), explainability: z.record(z.string(), z.unknown()).optional(),
}).strict().refine((value) => value.score === undefined || Boolean(value.scoreField), 'Score needs its original field name.');
export const suggestionSchema = z.object({
  id: text.optional(), title: text, rationale: z.string().max(2000),
  limitations: z.array(z.string()), evidenceEntityIds: z.array(z.string()),
}).strict();
const sourceFields = { wishId: id.optional(), tasteRunId: id.optional(), suggestionId: text.optional() };
export const giftRecordSchema = z.object({
  id, personId: id, occasionId: id.optional(), itemSource: z.enum(['inventory', 'external', 'experience']),
  inventoryItemId: id.optional(), quantity: z.number().int().positive(), giftTitle: text,
  status: z.enum(['planned', 'given', 'cancelled']), giftedAt: isoDate.optional(), occasionDate: isoDate.optional(), note,
  feedback: note, ...sourceFields,
  wishSnapshot: z.object({ title: text, sourceUrl: url.optional() }).strict().optional(),
  tasteSnapshot: z.object({ suggestion: suggestionSchema, evidence: z.array(evidenceSchema) }).strict().optional(),
  operationId: id, ...dates,
}).strict().superRefine((value, ctx) => {
  if ((value.itemSource === 'inventory') !== (value.inventoryItemId !== undefined)) ctx.addIssue({ code: 'custom', path: ['inventoryItemId'], message: 'Inventory source requires an inventory item; other sources must not reference one.' });
  if (value.status === 'given' && !value.giftedAt) ctx.addIssue({ code: 'custom', path: ['giftedAt'], message: 'A given gift needs its date.' });
  if (Boolean(value.wishId) !== Boolean(value.wishSnapshot)) ctx.addIssue({ code: 'custom', message: 'A recorded wish needs its captured source.' });
  if (Boolean(value.tasteRunId) !== Boolean(value.suggestionId) || Boolean(value.tasteRunId) !== Boolean(value.tasteSnapshot)) ctx.addIssue({ code: 'custom', message: 'An exploration selection needs its captured direction.' });
  if (value.tasteSnapshot) {
    const ids = new Set(value.tasteSnapshot.evidence.map((entry) => entry.entityId));
    if (!value.tasteSnapshot.suggestion.evidenceEntityIds.length || value.tasteSnapshot.suggestion.evidenceEntityIds.some((key) => !ids.has(key))) ctx.addIssue({ code: 'custom', message: 'Captured directions must retain their evidence.' });
  }
});

export const tasteRunSchema = z.object({
  id, personId: id.optional(),
  inputSignals: z.array(z.object({ original: text, qlooEntityId: z.string().optional(), qlooEntityType: z.string().optional(), matched: z.boolean() }).strict()
    .refine((value) => !value.matched || Boolean(value.qlooEntityId), 'A matched signal needs evidence.')),
  requestStatus: z.enum(['success', 'unavailable', 'partial', 'error']),
  qlooEvidence: z.array(evidenceSchema),
  suggestions: z.array(suggestionSchema).max(3),
  requestedAt: timestamp.optional(), createdAt: timestamp,
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.qlooEvidence.map((e) => e.entityId));
  if (value.suggestions.some((s) => !s.evidenceEntityIds.length || s.evidenceEntityIds.some((key) => !ids.has(key)))) ctx.addIssue({ code: 'custom', path: ['suggestions'], message: 'Suggestions must reference stored evidence.' });
  if (value.requestStatus === 'success' && !value.qlooEvidence.length) ctx.addIssue({ code: 'custom', path: ['qlooEvidence'], message: 'Success needs real evidence.' });
  if (value.requestStatus === 'unavailable' && (value.qlooEvidence.length || value.suggestions.length)) ctx.addIssue({ code: 'custom', message: 'Unavailable runs cannot contain recommendations.' });
  const suggestionIds = value.suggestions.flatMap((s) => s.id ? [s.id] : []);
  if (new Set(suggestionIds).size !== suggestionIds.length) ctx.addIssue({ code: 'custom', path: ['suggestions'], message: 'Suggestion IDs must be unique within an exploration.' });
});

export const addPersonSchema = z.object({ displayName: text.max(80), monthDay }).strict();
export const personInputSchema = personSchema.pick({ displayName: true, relationship: true, interests: true, dislikes: true, notes: true })
  .extend({ interests: personSchema.shape.interests.default([]) });
export const createPersonInputSchema = personInputSchema.extend({ monthDay: monthDay.optional(), reminderDaysBefore: z.array(z.number().int().min(0).max(365)).max(20).optional() })
  .refine((value) => value.monthDay !== undefined || value.reminderDaysBefore === undefined, 'Add a birthday before setting its reminders.');
export type CreatePersonInput = z.input<typeof createPersonInputSchema>;
export const wishInputSchema = wishSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const inventoryInputSchema = z.object({
  title: text, category: text.optional(), quantity: z.number().int().nonnegative(), location: text.optional(),
  description: note, currency: z.string().regex(/^[A-Z]{3}$/).optional(), unitCost: z.number().finite().nonnegative().optional(),
}).strict().refine((value) => value.unitCost === undefined || value.currency !== undefined, 'Cost needs a currency.');
export const giftInputSchema = z.object({
  personId: id, occasionId: id.optional(), occasionDate: isoDate.optional(), itemSource: z.enum(['inventory', 'external', 'experience']),
  inventoryItemId: id.optional(), quantity: z.number().int().positive(), giftTitle: text, note, ...sourceFields,
}).strict().superRefine((value, ctx) => {
  if ((value.itemSource === 'inventory') !== (value.inventoryItemId !== undefined)) ctx.addIssue({ code: 'custom', message: 'Inventory source requires an inventory item; other sources must not reference one.' });
  if (Boolean(value.tasteRunId) !== Boolean(value.suggestionId)) ctx.addIssue({ code: 'custom', message: 'An exploration and its suggestion must be selected together.' });
  if (value.occasionDate && !value.occasionId) ctx.addIssue({ code: 'custom', message: 'A preparation date needs its occasion.' });
});
export type WishInput = z.infer<typeof wishInputSchema>;
export type InventoryInput = z.infer<typeof inventoryInputSchema>;
export type GiftInput = z.infer<typeof giftInputSchema>;
export const occasionInputSchema = z.object({
  type: z.enum(['birthday', 'anniversary', 'other']), label: text, monthDay,
  year: z.number().int().min(1900).max(9999).optional(),
  recurrence: z.enum(['annual', 'once']), reminderDaysBefore: z.array(z.number().int().min(0).max(365)).max(20),
}).strict().superRefine((value, ctx) => {
  if (value.recurrence === 'once' && (value.year === undefined || !validMonthDay(value.monthDay, value.year))) {
    ctx.addIssue({ code: 'custom', path: ['year'], message: 'A one-time occasion needs a valid complete date.' });
  }
  if (value.type === 'birthday' && value.recurrence !== 'annual') {
    ctx.addIssue({ code: 'custom', path: ['recurrence'], message: 'Birthdays repeat every year.' });
  }
});
export type PersonInput = z.infer<typeof personInputSchema>;
export type OccasionInput = z.infer<typeof occasionInputSchema>;
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1), people: z.array(personSchema), occasions: z.array(occasionSchema),
  wishes: z.array(wishSchema), inventory: z.array(inventoryItemSchema), gifts: z.array(giftRecordSchema), tasteRuns: z.array(tasteRunSchema),
}).strict().superRefine((value, ctx) => {
  const people = new Set(value.people.map((p) => p.id));
  const items = new Set(value.inventory.map((p) => p.id));
  const occasions = new Map(value.occasions.map((p) => [p.id, p]));
  const invalid = value.occasions.some((o) => !people.has(o.personId)) ||
    value.wishes.some((w) => w.owner.kind === 'person' && !people.has(w.owner.personId)) ||
    value.gifts.some((g) => !people.has(g.personId) || (g.inventoryItemId && !items.has(g.inventoryItemId)) || (g.occasionId && occasions.get(g.occasionId)?.personId !== g.personId)) ||
    value.tasteRuns.some((t) => t.personId && !people.has(t.personId));
  if (invalid) ctx.addIssue({ code: 'custom', message: 'Related records must reference existing objects.' });
  for (const key of ['people', 'occasions', 'wishes', 'inventory', 'gifts', 'tasteRuns'] as const) {
    if (new Set(value[key].map((o) => o.id)).size !== value[key].length) ctx.addIssue({ code: 'custom', path: [key], message: 'Duplicate IDs.' });
  }
  if (new Set(value.gifts.map((g) => g.operationId)).size !== value.gifts.length) ctx.addIssue({ code: 'custom', path: ['gifts'], message: 'Duplicate operation IDs.' });
});

export type Person = z.infer<typeof personSchema>;
export type Occasion = z.infer<typeof occasionSchema>;
export type Wish = z.infer<typeof wishSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type GiftRecord = z.infer<typeof giftRecordSchema>;
export type TasteRun = z.infer<typeof tasteRunSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export const emptySnapshot = (): Snapshot => ({ schemaVersion: 1, people: [], occasions: [], wishes: [], inventory: [], gifts: [], tasteRuns: [] });
