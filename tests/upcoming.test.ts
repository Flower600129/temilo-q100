import { describe, expect, it } from 'vitest';
import { demoSeed } from '../src/storage/demo-seed';
import { upcomingOccasions } from '../src/domain/upcoming';
import type { Occasion } from '../src/domain/schemas';
const extra = (base: Occasion, changes: Partial<Occasion>): Occasion => ({ ...base, id: crypto.randomUUID(), ...changes });
describe('all upcoming occasions and in-app reminders', () => {
  it('sorts birthdays, annual anniversaries and one-time events across New Year', () => {
    const data = demoSeed(); const base = data.occasions[0];
    data.occasions = [
      extra(base, { type: 'anniversary', monthDay: '01-01' }),
      extra(base, { type: 'birthday', monthDay: '12-31' }),
      extra(base, { type: 'other', recurrence: 'once', year: 2027, monthDay: '01-02' }),
      extra(base, { type: 'other', recurrence: 'once', year: 2026, monthDay: '12-29' }),
    ];
    expect(upcomingOccasions(data, new Date(2026, 11, 30)).map((entry) => entry.days)).toEqual([1, 2, 3]);
  });
  it('keeps a one-time date today and never repeats an expired one', () => {
    const data = demoSeed(); data.occasions = [extra(data.occasions[0], { type: 'other', recurrence: 'once', year: 2026, monthDay: '11-08', reminderDaysBefore: [] })];
    expect(upcomingOccasions(data, new Date(2026, 10, 8, 23))[0].reminderDue).toBe(true);
    expect(upcomingOccasions(data, new Date(2026, 10, 9))).toEqual([]);
  });
  it('uses configured reminder offsets and leap-day observation for annual occasions', () => {
    const data = demoSeed(); data.occasions = [extra(data.occasions[0], { type: 'anniversary', monthDay: '02-29', reminderDaysBefore: [7] })];
    expect(upcomingOccasions(data, new Date(2027, 1, 21))[0]).toMatchObject({ days: 7, reminderDue: true, adjustedForLeapYear: true });
    expect(upcomingOccasions(data, new Date(2027, 1, 22))[0].reminderDue).toBe(false);
  });
});
