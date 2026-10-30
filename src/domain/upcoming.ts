import { daysBetween, nextBirthday } from './dates';
import type { Occasion, Person, Snapshot } from './schemas';

export type UpcomingBirthday = {
  person: Person;
  occasion: Occasion;
  date: Date;
  days: number;
  adjustedForLeapYear: boolean;
  reminderDue: boolean;
  inPreparationWindow: boolean;
};

export function upcomingOccasions(snapshot: Snapshot, today = new Date()): UpcomingBirthday[] {
  if (Number.isNaN(today.getTime())) throw new Error('Invalid current date.');
  const people = new Map(snapshot.people.map((person) => [person.id, person]));
  return snapshot.occasions
    .flatMap((occasion) => {
      const person = people.get(occasion.personId);
      if (!person) return [];
      const [month, day] = occasion.monthDay.split('-').map(Number);
      const next = occasion.recurrence === 'annual' ? nextBirthday(occasion.monthDay, today) : (() => {
        const date = new Date(occasion.year!, month - 1, day);
        return { date, days: daysBetween(today, date), adjustedForLeapYear: false };
      })();
      if (next.days < 0) return [];
      return [{ person, occasion, ...next, reminderDue: next.days === 0 || occasion.reminderDaysBefore.includes(next.days),
        inPreparationWindow: next.days <= Math.max(0, ...occasion.reminderDaysBefore) }];
    })
    .sort((a, b) => a.days - b.days || a.person.displayName.localeCompare(b.person.displayName));
}

export function upcomingBirthdays(snapshot: Snapshot, today = new Date()): UpcomingBirthday[] {
  return upcomingOccasions(snapshot, today).filter((entry) => entry.occasion.type === 'birthday' && entry.occasion.recurrence === 'annual');
}
