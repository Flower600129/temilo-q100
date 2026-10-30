import { expect, it } from 'vitest';
import { addPersonSchema, giftRecordSchema, inventoryItemSchema, occasionSchema, snapshotSchema, tasteRunSchema, wishSchema } from '@/domain/schemas';
import { allObjectsFixture } from './fixtures';

it('validates all six business objects and rejects orphans', () => {
  const value = allObjectsFixture(); expect(snapshotSchema.safeParse(value).success).toBe(true);
  value.people = []; expect(snapshotSchema.safeParse(value).success).toBe(false);
});
it('rejects empty names, excessive names, and invalid birthdays', () => {
  for (const input of [{ displayName: '  ', monthDay: '01-01' }, { displayName: 'a'.repeat(81), monthDay: '01-01' }, { displayName: 'Alex', monthDay: '04-31' }]) expect(addPersonSchema.safeParse(input).success).toBe(false);
  expect(addPersonSchema.parse({ displayName: ' Alex ', monthDay: '02-29' }).displayName).toBe('Alex');
});
it('requires a valid year for one-time occasions', () => {
  const value = { ...allObjectsFixture().occasions[0], recurrence: 'once' };
  expect(occasionSchema.safeParse(value).success).toBe(false);
  expect(occasionSchema.safeParse({ ...value, monthDay: '02-29', year: 2027 }).success).toBe(false);
});
it('rejects negative/fractional stock, invalid gift sources and quantities', () => {
  const value = allObjectsFixture();
  for (const quantity of [-1, 0.5]) expect(inventoryItemSchema.safeParse({ ...value.inventory[0], quantity }).success).toBe(false);
  expect(giftRecordSchema.safeParse({ ...value.gifts[0], quantity: 0 }).success).toBe(false);
  expect(giftRecordSchema.safeParse({ ...value.gifts[0], itemSource: 'external' }).success).toBe(false);
  expect(giftRecordSchema.safeParse({ ...value.gifts[0], status: 'given' }).success).toBe(false);
});
it('requires a person for a person-owned wish and disallows unsafe URL schemes', () => {
  const wish = allObjectsFixture().wishes[0];
  expect(wishSchema.safeParse({ ...wish, owner: { kind: 'person' } }).success).toBe(false);
  expect(wishSchema.safeParse({ ...wish, sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
});
it('does not allow success without Qloo evidence or invented evidence links', () => {
  const run = allObjectsFixture().tasteRuns[0];
  expect(tasteRunSchema.safeParse({ ...run, requestStatus: 'success' }).success).toBe(false);
  expect(tasteRunSchema.safeParse({ ...run, suggestions: [{ title: 'Fake', rationale: 'Fake', limitations: [], evidenceEntityIds: ['missing'] }] }).success).toBe(false);
});
