/**
 * Non-component helpers for the study panel (StudyPanel.tsx): the part model, scroll-tracked
 * "On this page" state and text utilities. Kept apart so StudyPanel.tsx exports only components.
 */
import { useEffect, useState } from 'react';

export interface StudyPart {
  id: string;
  label: string;
  /** A page tone class: sets `--tone` / `--tone-soft` for the part's dot, chip and accents. */
  toneClass: string;
}

// ---------- Scroll tracking ----------

/** The part currently being read: the first one whose block crosses a band near the top of the viewport. */
function useActivePart(ids: string[]) {
  const key = ids.join('|');
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const list = key.split('|');
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
        const first = list.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: '-25% 0px -60% 0px' },
    );
    list.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    // Edges the band can miss: above the first part the first is current, and a short last part
    // may never reach the band before the page ends.
    function onScroll() {
      const firstTop = document.getElementById(list[0])?.getBoundingClientRect().top ?? 0;
      if (firstTop > window.innerHeight * 0.25) {
        setActive(list[0]);
      } else if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(list[list.length - 1]);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [key]);

  return [active, setActive] as const;
}

/**
 * The active part plus a `jump` that scrolls to a part and moves focus there (part sections are
 * `tabIndex={-1}`), marking it active straight away.
 */
export function usePartNavigation(parts: StudyPart[]) {
  const [active, setActive] = useActivePart(parts.map((part) => part.id));

  function jump(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    setActive(id);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  return { active, jump };
}

export function textLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
