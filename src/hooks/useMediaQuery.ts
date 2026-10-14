import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, kept live. Lists use it to render either a table or cards (UI
 * spec §0.1), so only one copy of the data is in the DOM. Without `matchMedia` (tests, old
 * browsers) it reports `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** Tables from 768px (tablet and up), cards below. */
export const TABLE_QUERY = '(min-width: 768px)';
