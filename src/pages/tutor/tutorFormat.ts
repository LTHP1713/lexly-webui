/**
 * Pure helpers for the tutor screens (UI spec F5a): the `[n]` marker parser that turns an answer
 * into text and source references (never HTML), and the quota / expiry / duration formats.
 */
import { QUESTION_MAX } from '@/api/tutor';

/** A run of plain text, or a `[n]` marker whose `n` is one of the answer's citation refs. */
export type AnswerSegment = { kind: 'text'; text: string } | { kind: 'ref'; ref: number };

/** Paragraphs split on blank lines; single line breaks stay inside a paragraph's text. */
export function splitParagraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * Splits one paragraph on `[n]` markers. A marker counts wherever it appears (also straight after
 * a word, "void[1]."), but only when `n` is a known ref; any other bracketed number stays text.
 * Neighbouring text runs are merged, so an unknown marker doesn't break a sentence in two.
 */
export function parseMarkers(text: string, refs: ReadonlySet<number>): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.kind === 'text') last.text += value;
    else segments.push({ kind: 'text', text: value });
  };
  let index = 0;
  for (const match of text.matchAll(/\[(\d{1,3})\]/g)) {
    const ref = Number(match[1]);
    if (!refs.has(ref)) continue;
    pushText(text.slice(index, match.index));
    segments.push({ kind: 'ref', ref });
    index = match.index + match[0].length;
  }
  pushText(text.slice(index));
  return segments;
}

const HOUR = 3600_000;
const MINUTE = 60_000;

/** "deletes in 23 h", "deletes in 40 min", "deleting soon" once past `expiresAt`. */
export function formatExpiresIn(expiresAt: string | null, now = Date.now()): string {
  const time = expiresAt ? new Date(expiresAt).getTime() : NaN;
  if (Number.isNaN(time)) return '';
  const left = time - now;
  if (left <= 0) return 'deleting soon';
  if (left >= HOUR) return `deletes in ${Math.floor(left / HOUR)} h`;
  return `deletes in ${Math.max(1, Math.ceil(left / MINUTE))} min`;
}

/** `yyyy-MM-dd` of an instant in `timeZone` (the viewer's when omitted). */
function localDate(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * The quota's `resetsAt` (the next India midnight) in the viewer's local time: "12:00 am" in
 * India, "6:30 pm" in London; "4:30 am tomorrow" when it falls on a later local date and isn't
 * midnight there. `timeZone` is for tests; the app always uses the viewer's.
 */
export function formatResetsAt(resetsAt: string | null, now = Date.now(), timeZone?: string): string {
  const date = resetsAt ? new Date(resetsAt) : null;
  if (!date || Number.isNaN(date.getTime())) return 'midnight India time';
  const time = new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(date)
    .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`);
  const isMidnight = /^12:00 am$/.test(time);
  const later = localDate(date, timeZone) > localDate(new Date(now), timeZone);
  return later && !isMidnight ? `${time} tomorrow` : time;
}

/** "4 min 12 s", "1 h 3 min", "8 s". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

const usdFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** "$0.6447", "$12.00". */
export function formatUsd(value: number): string {
  return usdFormat.format(value);
}

/** Client checks mirroring `TutorAskRequest` (`@NotBlank`, `@Size(max = 2000)`). */
export function questionError(question: string): string | null {
  if (!question.trim()) return 'Type a question first.';
  if (question.length > QUESTION_MAX) return 'Questions can be at most 2,000 characters.';
  return null;
}
