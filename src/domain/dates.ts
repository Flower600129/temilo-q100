export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function validMonthDay(value: string, year = 2000): boolean {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const [month, day] = value.split('-').map(Number);
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= lengths[month - 1];
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Convert local calendar components to an ordinal, never elapsed local milliseconds.
function dayOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function daysBetween(today: Date, target: Date): number {
  return dayOrdinal(target) - dayOrdinal(today);
}

export function nextBirthday(monthDay: string, today = new Date()) {
  if (!validMonthDay(monthDay) || Number.isNaN(today.getTime())) throw new Error('Invalid birthday or current date.');
  const [month, day] = monthDay.split('-').map(Number);
  const inYear = (year: number) => new Date(year, month - 1, monthDay === '02-29' && !isLeapYear(year) ? 28 : day);
  let date = inYear(today.getFullYear());
  if (daysBetween(today, date) < 0) date = inYear(today.getFullYear() + 1);
  return { date, days: daysBetween(today, date), adjustedForLeapYear: monthDay === '02-29' && !isLeapYear(date.getFullYear()) };
}

export function formatBirthday(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(2000, month - 1, day));
}
