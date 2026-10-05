import styles from './Content.module.css';

/**
 * The search backend wraps matched terms in `<b>…</b>` (Postgres ts_headline-style). Only those
 * two tags are interpreted — everything else is rendered as plain text, never as HTML.
 */
export function HighlightedSnippet({ snippet }: { snippet: string }) {
  const parts: { text: string; highlighted: boolean }[] = [];
  let highlighted = false;
  for (const token of snippet.split(/(<\/?b>)/i)) {
    if (/^<b>$/i.test(token)) highlighted = true;
    else if (/^<\/b>$/i.test(token)) highlighted = false;
    else if (token) parts.push({ text: token, highlighted });
  }

  return (
    <span className={styles.snippet}>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark key={i} className={styles.highlight}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}
