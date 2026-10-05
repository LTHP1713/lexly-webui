export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const numberFormat = new Intl.NumberFormat('en-IN');
export function formatCount(value: number): string {
  return numberFormat.format(value);
}

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "2 hours ago", "yesterday", "just now". Returns null for an unparseable timestamp. */
export function formatRelative(isoTimestamp: string, now = Date.now()): string | null {
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) return null;
  const seconds = Math.round((then - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
