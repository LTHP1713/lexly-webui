import { useEffect } from 'react';

/**
 * A message to toast after a navigation ("Password updated."). Kept in module memory rather than
 * router state, so it never survives a reload or Back, and a redirect on the way (e.g. `/admin`
 * → its first page) can't drop it. `AppLayout` shows it; it stays mounted across navigations.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function flash(message: string) {
  pending = message;
  listeners.forEach((listener) => listener());
}

/** Shows any pending flash with `show` (now and whenever one arrives). `show` must be stable. */
export function useFlash(show: (message: string) => void) {
  useEffect(() => {
    const take = () => {
      if (pending === null) return;
      const message = pending;
      pending = null;
      show(message);
    };
    take();
    listeners.add(take);
    return () => {
      listeners.delete(take);
    };
  }, [show]);
}
