import { useAppLayout } from '@/components/appLayoutContext';
import { CourthouseIcon } from '@/components/icons/Icons';
import { BareActProgress } from './BareActProgress';
import { ContinueLearning } from './ContinueLearning';
import { greetingFor } from './format';
import { PracticeProgress } from './PracticeProgress';
import { QuickActions } from './QuickActions';
import { UniversalSearch } from './UniversalSearch';
import styles from './Home.module.css';

const dateFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Home dashboard. Each card loads independently, so one failing endpoint never blanks the page.
 * Visual order: search → quick actions → practice → bare acts → continue learning.
 */
export function HomePage() {
  // Loaded once by AppLayout (GET /users/me); until it exists the greeting is deliberately nameless.
  const { firstName } = useAppLayout();
  const now = new Date();

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-greeting">
        <div className={styles.heroArt} aria-hidden="true">
          <CourthouseIcon size="100%" strokeWidth={0.6} />
        </div>
        <p className={styles.heroDate}>{dateFormat.format(now)}</p>
        <h1 id="home-greeting" className={styles.greeting}>
          {greetingFor(now)}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className={styles.heroPrompt}>What do you want to learn today?</p>
        <UniversalSearch />
      </section>

      <QuickActions />

      <div className={styles.dashboard}>
        <PracticeProgress />
        <BareActProgress />
        <ContinueLearning />
      </div>
    </div>
  );
}
