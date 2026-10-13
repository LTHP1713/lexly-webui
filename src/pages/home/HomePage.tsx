import { useAppLayout } from '@/components/appLayoutContext';
import { CourthouseIcon } from '@/components/icons/Icons';
import { backendFeatures, homeMockMode } from '@/config/features';
import { BareActProgress } from './BareActProgress';
import { ContinueLearning } from './ContinueLearning';
import { greetingFor } from './format';
import { QuickActions } from './QuickActions';
import { UniversalSearch } from './UniversalSearch';
import styles from './Home.module.css';

const dateFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Home dashboard (S_STUDENT). Visual order: search → quick actions → continue learning → bare
 * acts. The two progress cards depend on endpoints TDD v2 dropped, so they aren't rendered at all
 * while their flag is off (decision D3); each loads independently when it is on.
 */
export function HomePage() {
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

      {(backendFeatures.learningProgress || homeMockMode) && (
        <div className={styles.dashboard}>
          <BareActProgress />
          <ContinueLearning />
        </div>
      )}
    </div>
  );
}
