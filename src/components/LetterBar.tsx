import { useEffect, useRef, type KeyboardEvent } from 'react';
import styles from './LetterBar.module.css';

const OTHER = '#';

/**
 * All · A … Z · # toggle buttons for an A–Z list (UI spec F5b.3). One tab stop with a roving
 * tabindex: ←/→ move, Home/End jump to the ends, Enter/Space choose. On phones the row scrolls
 * sideways inside itself, and the pressed letter is kept in view.
 */
export function LetterBar({
  letters,
  value,
  label,
  onChange,
}: {
  letters: string[];
  /** The pressed letter, or `null` for All. */
  value: string | null;
  label: string;
  onChange: (letter: string | null) => void;
}) {
  const options: (string | null)[] = [null, ...letters];
  const current = Math.max(0, options.indexOf(value));
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    buttons.current[current]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const from = buttons.current.findIndex((button) => button === document.activeElement);
    if (from < 0) return;
    let to = from;
    if (event.key === 'ArrowRight') to = Math.min(options.length - 1, from + 1);
    else if (event.key === 'ArrowLeft') to = Math.max(0, from - 1);
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = options.length - 1;
    else return;
    event.preventDefault();
    buttons.current[to]?.focus();
  }

  return (
    <div role="group" aria-label={label} className={styles.bar} onKeyDown={onKeyDown}>
      {options.map((letter, index) => (
        <button
          key={letter ?? 'ALL'}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          className={`${styles.letter} ${letter === null ? styles.all : ''}`}
          aria-pressed={index === current}
          aria-label={letter === OTHER ? 'Other: not starting with A to Z' : undefined}
          tabIndex={index === current ? 0 : -1}
          onClick={() => onChange(letter)}
        >
          {letter ?? 'All'}
        </button>
      ))}
    </div>
  );
}
