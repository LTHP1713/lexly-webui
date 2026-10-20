/**
 * The spend tab's date range (UI spec F5a.4). Dates are `yyyy-MM-dd` India dates, as the backend
 * groups usage by the day in Asia/Kolkata; the default is the last 30 days up to today there.
 */

const DEFAULT_DAYS = 30;
/** Inclusive; mirrors `AiUsageReportService.MAX_DAYS`. */
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

/** Today's date in India. */
export function indiaToday(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Days since the epoch of a `yyyy-MM-dd` date, or `null` when invalid. */
function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(time);
  // Rejects 2026-02-31 and friends.
  if (date.getUTCDate() !== Number(match[3])) return null;
  return time / DAY_MS;
}

export function addDays(value: string, days: number): string {
  const day = dayNumber(value);
  return day === null ? value : new Date((day + days) * DAY_MS).toISOString().slice(0, 10);
}

export function defaultRange(now = Date.now()): { from: string; to: string } {
  const to = indiaToday(now);
  return { from: addDays(to, -(DEFAULT_DAYS - 1)), to };
}

/** The client-side check before a request (the server answers `400` for the same cases). */
export function rangeError(from: string, to: string): string | null {
  const first = dayNumber(from);
  const last = dayNumber(to);
  if (first === null || last === null) return 'Enter both dates.';
  if (last < first) return 'The start date must be on or before the end date.';
  if (last - first + 1 > MAX_RANGE_DAYS) return `Choose a range of at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "19 Oct" (the date itself, no timezone shift). */
export function formatShortDate(value: string): string {
  const day = dayNumber(value);
  return day === null ? value : shortDate.format(new Date(day * DAY_MS));
}

/** "19 Oct 2026". */
export function formatLongDate(value: string): string {
  const day = dayNumber(value);
  return day === null ? value : longDate.format(new Date(day * DAY_MS));
}

/** The smallest 1 / 2 / 5 × 10ⁿ at or above `value`, so the chart's gridlines land on round amounts. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}
