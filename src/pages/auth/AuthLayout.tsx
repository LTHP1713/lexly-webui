import type { ReactNode } from 'react';
import { BookIcon, ChatIcon, ScalesIcon } from '@/components/icons/Icons';
import styles from './AuthLayout.module.css';

const FEATURES = [
  { tone: 'lavender', icon: BookIcon, title: 'Bare acts', text: 'Every section, in simple words' },
  { tone: 'mint', icon: ScalesIcon, title: 'Case laws', text: 'Landmark judgments, linked to sections' },
  { tone: 'cream', icon: ChatIcon, title: 'AI tutor', text: 'Answers that cite their sources' },
] as const;

/**
 * Shared frame for sign-in, registration and the forced password change (UI spec UR.4). Phones: a
 * compact black brand band above the form. From 1024px: the pale page with a black frame holding
 * the brand panel (logo, hero line, three feature cards) and a white panel with the form.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.brandPanel}>
          <div className={styles.brand}>
            <span className={styles.logoTile} aria-hidden="true">
              §
            </span>
            <div>
              <p className={styles.brandName}>Lexly</p>
              <p className={styles.tagline}>Your legal intelligence partner</p>
            </div>
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.heroTitle}>
              Learn law. Understand it. <span className={styles.heroPill}>Master it.</span>
            </p>
            <p className={styles.heroText}>Your study companion for bare acts, case laws, concepts and practice.</p>
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
