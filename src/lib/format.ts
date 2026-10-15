/**
 * Display formats from UI spec §0.4: the viewer's local time in `en-IN`. Instants from the backend
 * are ISO-8601 UTC, possibly with fractional seconds, so they are parsed with `Date`, never with a
 * fixed pattern. Unparseable values come back as "—".
 */

const instantFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const numberFormat = new Intl.NumberFormat('en-IN');

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `13 Oct 2026, 2:45 pm`. */
export function formatInstant(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? instantFormat.format(date).replace(/\b(AM|PM)\b/, (m) => m.toLowerCase()) : '—';
}

/** `13 Oct 2026` (an instant shown as a date, e.g. "Added"). */
export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dateFormat.format(date) : '—';
}

/** `1,180`. */
export function formatCount(value: number): string {
  return numberFormat.format(value);
}

/**
 * In lists: relative within 24 hours ("5 minutes ago"), else the full instant. Pair it with
 * `formatInstant` in a `title` so the exact time is one hover away.
 */
export function formatListInstant(iso: string | null | undefined, now = Date.now()): string {
  const date = parse(iso);
  if (!date) return '—';
  const seconds = Math.round((date.getTime() - now) / 1000);
  if (Math.abs(seconds) >= 24 * 3600) return formatInstant(iso);
  if (Math.abs(seconds) >= 3600) return relativeFormat.format(Math.round(seconds / 3600), 'hour');
  if (Math.abs(seconds) >= 60) return relativeFormat.format(Math.round(seconds / 60), 'minute');
  return 'just now';
}

/** `yyyy-MM-dd` of a local date, for `<input type="date">`. */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The instant at local midnight starting `yyyy-MM-dd`, plus `addDays`; null when invalid. */
export function startOfLocalDay(value: string, addDays = 0): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + addDays);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** `845 B`, `12.4 KB`, `3.2 MB` (file sizes, base 1024). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(kb / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** Marks with up to one decimal and no trailing `.0` (UI spec §0.4): `7.5`, `10`. */
export function formatMarks(value: number): string {
  return String(Math.round(value * 10) / 10);
}
