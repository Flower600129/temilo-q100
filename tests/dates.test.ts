import { describe, expect, it } from 'vitest';
import { daysBetween, isLeapYear, nextBirthday, validMonthDay } from '@/domain/dates';

describe('birthday calendar rules', () => {
  it('keeps today at zero even late in the day', () => {
    expect(nextBirthday('11-08', new Date(2026, 10, 8, 23, 59)).days).toBe(0);
  });
  it('moves a past birthday to the next year', () => {
    const next = nextBirthday('10-01', new Date(2026, 9, 24));
    expect(next.date.getFullYear()).toBe(2027); expect(next.days).toBe(342);
  });
  it('orders December/January across the year boundary', () => {
    const today = new Date(2026, 11, 30);
    expect(nextBirthday('12-31', today).days).toBe(1);
    expect(nextBirthday('01-01', today).days).toBe(2);
  });
  it('observes leap birthdays on February 28 in non-leap years', () => {
    const next = nextBirthday('02-29', new Date(2027, 1, 27));
    expect(next.days).toBe(1); expect(next.date.getDate()).toBe(28); expect(next.adjustedForLeapYear).toBe(true);
    expect(nextBirthday('02-29', new Date(2027, 1, 28, 23)).days).toBe(0);
  });
  it('returns to February 29 in a leap year', () => {
    const next = nextBirthday('02-29', new Date(2027, 2, 1));
    expect(next.date.getFullYear()).toBe(2028); expect(next.date.getDate()).toBe(29); expect(next.adjustedForLeapYear).toBe(false);
  });
  it('uses calendar days across DST boundaries', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9))).toBe(2);
      expect(daysBetween(new Date(2026, 9, 31), new Date(2026, 10, 2))).toBe(2);
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  });
  it('rejects impossible dates without normalizing them', () => {
    for (const date of ['02-30', '04-31', '00-12', '13-01', '1-01']) expect(validMonthDay(date)).toBe(false);
    expect(validMonthDay('02-29')).toBe(true); expect(validMonthDay('02-29', 2027)).toBe(false);
    expect(() => nextBirthday('02-30')).toThrow();
    expect(isLeapYear(1900)).toBe(false); expect(isLeapYear(2000)).toBe(true);
  });
});
