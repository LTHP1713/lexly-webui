/** F3 `Deadline` countdown boundaries and the server clock correction (F3.10). */
import { describe, expect, it } from 'vitest';
import { clockOffset, timeLeft } from './deadline';

const due = '2026-11-02T12:00:00Z';
const at = (msBefore: number) => new Date(due).getTime() - msBefore;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('timeLeft', () => {
  it('has nothing to say without a due date or with an unreadable one', () => {
    expect(timeLeft(null, Date.now())).toBeNull();
    expect(timeLeft('not a date', Date.now())).toBeNull();
  });

  it('counts whole days from 24 hours, not yet "soon"', () => {
    expect(timeLeft(due, at(3 * DAY + 5 * HOUR))).toEqual({ text: 'in 3 days', soon: false, past: false });
    expect(timeLeft(due, at(DAY))).toEqual({ text: 'in 1 day', soon: false, past: false });
  });

  it('is "soon" just under 24 hours, in hours and minutes', () => {
    expect(timeLeft(due, at(DAY - 1))).toEqual({ text: 'in 23 h 59 min', soon: true, past: false });
    expect(timeLeft(due, at(5 * HOUR + 12 * MIN))).toEqual({ text: 'in 5 h 12 min', soon: true, past: false });
    expect(timeLeft(due, at(2 * HOUR))).toEqual({ text: 'in 2 h', soon: true, past: false });
  });

  it('counts minutes under an hour, then "less than a minute"', () => {
    expect(timeLeft(due, at(HOUR - 1))).toMatchObject({ text: 'in 59 min', soon: true });
    expect(timeLeft(due, at(MIN))).toMatchObject({ text: 'in 1 min' });
    expect(timeLeft(due, at(MIN - 1))).toMatchObject({ text: 'in less than a minute' });
    expect(timeLeft(due, at(1))).toMatchObject({ text: 'in less than a minute', past: false });
  });

  it('is past at the due date itself and after it', () => {
    expect(timeLeft(due, at(0))).toEqual({ text: '', soon: false, past: true });
    expect(timeLeft(due, at(-DAY))).toMatchObject({ past: true });
  });
});

describe('clockOffset', () => {
  it('is server time minus device time when the response arrived', () => {
    const received = new Date('2026-11-02T11:55:00Z').getTime();
    expect(clockOffset('2026-11-02T12:00:00Z', received)).toBe(5 * MIN);
    expect(clockOffset('2026-11-02T11:50:00Z', received)).toBe(-5 * MIN);
  });

  it('is 0 without a usable server time', () => {
    expect(clockOffset(null, Date.now())).toBe(0);
    expect(clockOffset('garbage', Date.now())).toBe(0);
  });
});
