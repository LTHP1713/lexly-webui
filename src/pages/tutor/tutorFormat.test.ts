import { describe, expect, it } from 'vitest';
import { addDays, defaultRange, indiaToday, niceMax, rangeError } from '@/pages/admin/tutor/spendRange';
import {
  formatDuration,
  formatExpiresIn,
  formatResetsAt,
  formatUsd,
  parseMarkers,
  questionError,
  splitParagraphs,
} from './tutorFormat';

const refs = new Set([1, 2]);

describe('parseMarkers', () => {
  it('turns known markers into refs and leaves unknown ones as text', () => {
    expect(parseMarkers('Void [1] and voidable [7].', refs)).toEqual([
      { kind: 'text', text: 'Void ' },
      { kind: 'ref', ref: 1 },
      { kind: 'text', text: ' and voidable [7].' },
    ]);
  });

  it('splits adjacent markers', () => {
    expect(parseMarkers('Settled law [1][2]', refs)).toEqual([
      { kind: 'text', text: 'Settled law ' },
      { kind: 'ref', ref: 1 },
      { kind: 'ref', ref: 2 },
    ]);
  });

  it('finds markers straight after or inside a word', () => {
    expect(parseMarkers('void[1].', refs)).toEqual([
      { kind: 'text', text: 'void' },
      { kind: 'ref', ref: 1 },
      { kind: 'text', text: '.' },
    ]);
    expect(parseMarkers('ab[2]cd', refs)).toEqual([
      { kind: 'text', text: 'ab' },
      { kind: 'ref', ref: 2 },
      { kind: 'text', text: 'cd' },
    ]);
  });

  it('leaves text without markers, or with no citations, alone', () => {
    expect(parseMarkers('No sources [1].', new Set())).toEqual([{ kind: 'text', text: 'No sources [1].' }]);
    expect(parseMarkers('Article [a] and [ 1 ]', refs)).toEqual([{ kind: 'text', text: 'Article [a] and [ 1 ]' }]);
  });
});

describe('splitParagraphs', () => {
  it('splits on blank lines and keeps single line breaks', () => {
    expect(splitParagraphs('One\nstill one\n\n  \nTwo\r\n\r\nThree')).toEqual(['One\nstill one', 'Two', 'Three']);
  });
});

describe('formatResetsAt', () => {
  // The next India midnight after 20 Oct 2026.
  const resetsAt = '2026-10-20T18:30:00Z';
  const now = Date.parse('2026-10-20T10:00:00Z');

  it('shows midnight to a viewer in India', () => {
    expect(formatResetsAt(resetsAt, now, 'Asia/Kolkata')).toBe('12:00 am');
  });

  it('shows the same instant in the viewer’s own time zone', () => {
    expect(formatResetsAt(resetsAt, now, 'Europe/London')).toBe('7:30 pm');
    expect(formatResetsAt(resetsAt, now, 'America/Los_Angeles')).toBe('11:30 am');
  });

  it('says tomorrow when it falls on a later local date', () => {
    expect(formatResetsAt(resetsAt, now, 'Australia/Sydney')).toBe('5:30 am tomorrow');
  });

  it('falls back when the server sent no time', () => {
    expect(formatResetsAt(null, now)).toBe('midnight India time');
  });
});

describe('formatExpiresIn', () => {
  const now = Date.parse('2026-10-20T10:00:00Z');
  it('counts down in hours, then minutes', () => {
    expect(formatExpiresIn('2026-10-21T09:59:00Z', now)).toBe('deletes in 23 h');
    expect(formatExpiresIn('2026-10-20T10:40:00Z', now)).toBe('deletes in 40 min');
    expect(formatExpiresIn('2026-10-20T10:00:20Z', now)).toBe('deletes in 1 min');
    expect(formatExpiresIn('2026-10-20T09:00:00Z', now)).toBe('deleting soon');
    expect(formatExpiresIn(null, now)).toBe('');
  });
});

describe('other formats', () => {
  it('formats durations and money', () => {
    expect(formatDuration(252_000)).toBe('4 min 12 s');
    expect(formatDuration(3_780_000)).toBe('1 h 3 min');
    expect(formatDuration(8_000)).toBe('8 s');
    expect(formatUsd(0.6447)).toBe('$0.6447');
    expect(formatUsd(12)).toBe('$12.00');
  });

  it('checks questions like the server', () => {
    expect(questionError('   ')).toBe('Type a question first.');
    expect(questionError('x'.repeat(2001))).toBe('Questions can be at most 2,000 characters.');
    expect(questionError('x'.repeat(2000))).toBeNull();
  });
});

describe('spend range', () => {
  it('defaults to the last 30 India days', () => {
    // 20:00 UTC is already the 21st in India.
    const now = Date.parse('2026-10-20T20:00:00Z');
    expect(indiaToday(now)).toBe('2026-10-21');
    expect(defaultRange(now)).toEqual({ from: '2026-09-22', to: '2026-10-21' });
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('checks order and an inclusive 366-day limit', () => {
    expect(rangeError('2026-10-02', '2026-10-01')).toBe('The start date must be on or before the end date.');
    expect(rangeError('2025-10-20', '2026-10-21')).toBe('Choose a range of at most 366 days.');
    expect(rangeError('2025-10-21', '2026-10-21')).toBeNull();
    expect(rangeError('', '2026-10-21')).toBe('Enter both dates.');
    expect(rangeError('2026-02-31', '2026-03-01')).toBe('Enter both dates.');
  });

  it('rounds the chart scale up to 1, 2 or 5', () => {
    expect(niceMax(0)).toBe(0);
    expect(niceMax(0.6447)).toBe(1);
    expect(niceMax(0.13)).toBeCloseTo(0.2);
    expect(niceMax(42)).toBe(50);
  });
});
