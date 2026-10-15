/**
 * Due dates (UI spec F3 `Deadline`): "in 3 days", "in 5 h 12 min", "Due soon" under 24 hours,
 * and a clock that can be corrected with the server's `serverTime`, so a student whose phone
 * clock is wrong still sees the real time left.
 */
import { useEffect, useState } from 'react';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface TimeLeft {
  /** "in 3 days" / "in 5 h 12 min" / "in 12 min" / "in less than a minute"; "" once past. */
  text: string;
  /** Under 24 hours left. */
  soon: boolean;
  past: boolean;
}

export function timeLeft(dueAt: string | null, now: number): TimeLeft | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const ms = due - now;
  if (ms <= 0) return { text: '', soon: false, past: true };
  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    return { text: `in ${days} ${days === 1 ? 'day' : 'days'}`, soon: false, past: false };
  }
  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return { text: minutes ? `in ${hours} h ${minutes} min` : `in ${hours} h`, soon: true, past: false };
  }
  if (ms >= MINUTE) return { text: `in ${Math.floor(ms / MINUTE)} min`, soon: true, past: false };
  return { text: 'in less than a minute', soon: true, past: false };
}

/** `serverTime − device time` when a response arrived; 0 without a server time. */
export function clockOffset(serverTime: string | null, receivedAt: number): number {
  if (!serverTime) return 0;
  const server = new Date(serverTime).getTime();
  return Number.isNaN(server) ? 0 : server - receivedAt;
}

/**
 * The current time plus `offset`, re-rendered every 30 s, every second in the last minute before
 * `dueAt`, and paused while the tab is hidden (it catches up when shown again).
 */
export function useNow(offset = 0, dueAt: string | null = null): number {
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      const current = Date.now() + offset;
      setNow(current);
      const due = dueAt ? new Date(dueAt).getTime() : NaN;
      const left = due - current;
      let delay = 30_000;
      if (left > 0 && left <= MINUTE) delay = 1000;
      // Wake up as the last minute starts, so the 1 s ticks begin on time.
      else if (left > MINUTE && left < MINUTE + delay) delay = left - MINUTE + 50;
      if (document.visibilityState !== 'hidden') timer = window.setTimeout(tick, delay);
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'hidden') tick();
    };
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [offset, dueAt]);

  return now;
}
