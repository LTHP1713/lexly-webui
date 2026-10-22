/**
 * The Lexly logo (docs/brand/lexly-logo.png): the heavy "Lexly" wordmark with a lavender
 * four-point spark at the top right of the "y". Drawn in code, not shipped as an image, so it
 * stays sharp at every size and takes its colour from the surrounding text (`currentColor`).
 *
 * The spark means AI: outside the logo it marks only the tutor and other AI moments, so users
 * learn to read it. The pulsing spark is the AI's "working" state.
 */
import styles from './Logo.module.css';

/** The spark's outline in a 24 × 24 box: four concave arcs between the tips. */
export const SPARK_PATH = 'M12 0C12.5 7.4 15 11.3 24 12C15 12.7 12.5 16.6 12 24C11.5 16.6 9 12.7 0 12C9 11.3 11.5 7.4 12 0Z';

/**
 * The spark alone, for AI moments. Decorative: always `aria-hidden`, so pair it with text.
 * `pulse` breathes and turns it (still under reduced motion; the text carries the state).
 */
export function LexlySpark({
  size = 16,
  className,
  pulse = false,
}: {
  size?: number | string;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <svg
      className={`${pulse ? styles.pulse : ''} ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SPARK_PATH} fill="var(--lx-spark, #9d8cff)" />
    </svg>
  );
}

/**
 * The wordmark. Scales with `font-size` (pass `size` in CSS units); the text is real text, so the
 * accessible name is "Lexly" unless a wrapping link labels it.
 */
export function LexlyWordmark({ size, className }: { size?: string; className?: string }) {
  return (
    <span className={`${styles.wordmark} ${className ?? ''}`} style={size ? { fontSize: size } : undefined}>
      Lexly
      <LexlySpark size="0.46em" className={styles.spark} />
    </span>
  );
}

/**
 * The square app mark: a white "L" and the spark on the brand black tile. Used where the full
 * wordmark doesn't fit (the collapsed sidebar, the session splash) and as the favicon. `pulse`
 * animates the spark alone, for the loading splash.
 */
export function LexlyMark({ size = 28, pulse = false }: { size?: number | string; pulse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--lx-brand-black, #0b0b0d)" />
      <path d="M8 7.5h4.25v13.25H19.5V24.5H8z" fill="#fff" />
      {/* A CSS animation would override a transform on the path itself, so the path sits in a group. */}
      <g transform="translate(17.25 5.25) scale(0.4)">
        <path d={SPARK_PATH} className={pulse ? styles.pulse : undefined} fill="var(--lx-spark, #9d8cff)" />
      </g>
    </svg>
  );
}
