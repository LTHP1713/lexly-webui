import type { ReactNode } from 'react';
import { LexlyMark } from '@/components/icons/Icons';
import { AuthIllustration } from './AuthIllustration';
import styles from './AuthLayout.module.css';

/**
 * Shared frame for Login and Register. Phones: a compact navy brand band (wordmark + cropped
 * illustration) above the form. Tablet portrait: a medium band with the hero copy beside the
 * illustration, form in a card below. Desktop (≥1024px): split screen, brand panel on the left.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.brandPanel}>
        <div className={styles.brand}>
          <span className={styles.markWrap}>
            <LexlyMark size={36} />
          </span>
          <div>
            <p className={styles.brandName}>Lexly</p>
            <p className={styles.tagline}>Your Legal Intelligence Partner</p>
          </div>
        </div>

        <div className={styles.art}>
          <AuthIllustration className={styles.artFull} />
          <AuthIllustration compact className={styles.artCompact} />
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.heroTitle}>
            Learn law. Understand it. <span className={styles.heroAccent}>Master it.</span>
          </p>
          <p className={styles.heroText}>Your study companion for Bare Acts, case laws, concepts and practice.</p>
        </div>
      </header>

      <main className={styles.formPanel}>
        <div className={styles.formInner}>{children}</div>
      </main>
    </div>
  );
}
