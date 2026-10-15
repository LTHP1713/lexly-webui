/**
 * `<input type="datetime-local">` holds a wall-clock time without a zone; the API wants an
 * ISO-8601 UTC instant. Both directions use the viewer's own time zone (UI spec F3 `DateTimeField`).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** An instant → `yyyy-MM-ddTHH:mm` in local time; '' for null or an unparseable value. */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `yyyy-MM-ddTHH:mm` (seconds optional) in local time → ISO UTC; null for '' or an invalid value. */
export function fromDateTimeLocal(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, Number.isNaN(s) ? 0 : s);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "Asia/Kolkata (GMT+5:30)": the zone the field's times are in. */
export function timeZoneLabel(date = new Date()): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const offset = `GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ''}`;
  return zone ? `${zone} (${offset})` : offset;
}
