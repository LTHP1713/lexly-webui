import type { ReactNode } from 'react';
import { LexlySpark, LexlyWordmark } from '@/components/brand/Logo';
import { BookIcon, ScalesIcon, SparkIcon } from '@/components/icons/Icons';
import styles from './AuthLayout.module.css';

const FEATURES = [
  { tone: 'lavender', icon: BookIcon, title: 'Bare acts', text: 'Every section, in simple words' },
  { tone: 'mint', icon: ScalesIcon, title: 'Case laws', text: 'Landmark judgments, linked to sections' },
  { tone: 'cream', icon: SparkIcon, title: 'AI tutor', text: 'Answers that cite their sources' },
] as const;

/**
 * Shared frame for sign-in, registration and the forced password change (UI spec UR.4). Phones: a
 * compact black brand band (logo and the motto) above the form. From 1024px: the pale page with a
 * black frame holding the brand panel (logo, the motto as the hero line, three feature cards) and a
 * white panel with the form.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.brandPanel}>
          <div className={styles.brand}>
            <LexlyWordmark className={styles.wordmark} />
            <p className={styles.tagline}>Your legal intelligence partner</p>
          </div>

          <div className={styles.heroCopy}>
            <figure className={styles.motto}>
              <blockquote className={styles.mottoQuote}>
                <p className={styles.heroTitle}>
                  Knowledge is{' '}
                  <span className={styles.heroPill}>
                    power.
                    <LexlySpark size="0.5em" className={styles.pillSpark} />
                  </span>
                </p>
              </blockquote>
            </figure>
            <p className={styles.heroText}>Bare acts, case laws and an AI tutor that cites its sources, all in one place.</p>
          </div>

          <ul className={styles.features} aria-label="What Lexly offers">
            {FEATURES.map(({ tone, icon: FeatureIcon, title, text }) => (
              <li key={title} className={`${styles.feature} ${styles[`feature_${tone}`]}`}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <FeatureIcon size={20} />
                </span>
                <span className={styles.featureTitle}>{title}</span>
                <span className={styles.featureText}>{text}</span>
              </li>
            ))}
          </ul>
        </header>

        <main className={styles.formPanel}>
          <div className={styles.formInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
