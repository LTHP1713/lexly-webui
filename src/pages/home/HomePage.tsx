import { Link } from 'react-router-dom';
import { listCaseLaws } from '@/api/caselaws';
import { listActs } from '@/api/content';
import { getTutorQuota } from '@/api/tutor';
import { useAppLayout } from '@/components/appLayoutContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import {
  ActionCard,
  DashboardHeader,
  DashboardRow,
  DashboardSection,
  Placard,
  PlacardGroup,
  RowChip,
} from '@/components/dashboard/Dashboard';
import { cardState } from '@/components/dashboard/cardState';
import { BookIcon, ScalesIcon, SparkIcon } from '@/components/icons/Icons';
import { backendFeatures, homeMockMode } from '@/config/features';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatCount } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { BareActProgress } from './BareActProgress';
import { ContinueLearning } from './ContinueLearning';
import { greetingFor } from './format';
import { UniversalSearch } from './UniversalSearch';
import dash from '@/components/dashboard/Dashboard.module.css';
import homeStyles from './Home.module.css';
import styles from '@/components/ui.module.css';

/**
 * `/dashboard`: the solo student's **Study hub** (UI spec UR.3). Library search with act
 * shortcuts, placards for bare acts, case laws and tutor questions left today, the bare acts and
 * a tutor card. The two progress cards depend on endpoints TDD v2 dropped, so they render only
 * while their flag is on (decision D3).
 */
export function HomePage() {
  const { firstName } = useAppLayout();
  const acts = useCachedQuery(queryKeys.library.acts, () => listActs());
  const caseLaws = useCachedQuery(queryKeys.library.caseLawCount, () => listCaseLaws({ page: 0, size: 1 }));
  const quota = useCachedQuery(queryKeys.tutor.quota, (signal) => getTutorQuota(signal));
  const actList = acts.status === 'success' ? acts.data : [];

  return (
    <div className={dash.page}>
      <DashboardHeader eyebrow={`${greetingFor(new Date())}${firstName ? `, ${firstName}` : ''}`} title="Study hub" />

      <DashboardRow>
        <section className={`${dash.hero} ${homeStyles.searchHero}`} aria-labelledby="home-search">
          <h2 id="home-search" className={homeStyles.searchTitle}>
            Find any section or case law
          </h2>
          <UniversalSearch />
          {actList.length > 0 && (
            <ul className={homeStyles.shortcuts} aria-label="Popular acts">
              {actList.slice(0, 3).map((act) => (
                <li key={act.id}>
                  <Link to={`/acts/${encodeURIComponent(act.id)}`} className={homeStyles.shortcut}>
                    {act.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PlacardGroup id="home-library" title="Your library">
          <Placard
            to="/acts"
            tone="lavender"
            value={formatCount(actList.length)}
            label="Bare acts"
            action="Browse"
            icon={BookIcon}
            state={cardState(acts)}
          />
          <Placard
            to="/caselaws"
            tone="mint"
            value={caseLaws.status === 'success' ? formatCount(caseLaws.data.totalElements) : ''}
            label="Case laws"
            action="Browse"
            icon={ScalesIcon}
            state={cardState(caseLaws)}
          />
          <Placard
            to="/tutor"
            tone="cream"
            value={quota.status === 'success' ? `${formatCount(quota.data.remaining)} of ${formatCount(quota.data.limit)}` : ''}
            label="Tutor questions left today"
            action="Tutor"
            icon={SparkIcon}
            state={cardState(quota)}
          />
        </PlacardGroup>
      </DashboardRow>

      <DashboardRow>
        <DashboardSection id="home-acts" title="Bare acts" more={{ to: '/acts', label: 'See all' }}>
          {acts.status === 'loading' && <LoadingState label="Loading bare acts" lines={3} />}
          {acts.status === 'error' && <ErrorState error={acts.error} onRetry={acts.retry} />}
          {acts.status === 'success' &&
            (actList.length === 0 ? (
              <EmptyState>No acts have been added yet.</EmptyState>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${dash.compactTable}`}>
                  <caption className={styles.visuallyHidden}>Bare acts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Act</th>
                      <th scope="col" className={styles.actionsCell}>
                        <span className={styles.visuallyHidden}>Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {actList.slice(0, 3).map((act) => (
                      <tr key={act.id}>
                        <th scope="row">
                          <span className={dash.nameCell}>
                            <RowChip>{(act.shortCode ?? act.title).slice(0, 3)}</RowChip>
                            <span className={dash.nameText}>
                              <span>{act.title}</span>
                              {act.shortCode && <span>{act.shortCode}</span>}
                            </span>
                          </span>
                        </th>
                        <td className={styles.actionsCell}>
                          <Link to={`/acts/${encodeURIComponent(act.id)}`} className={dash.moreLink} aria-label={`Sections of ${act.title}`}>
                            Sections <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </DashboardSection>

        <ActionCard
          ai
          id="home-tutor"
          before="Learn with the"
          pill="tutor"
          text="Ask in plain words and get answers that cite the sections and case laws behind them. Solo practice is coming soon."
          to="/tutor"
          label="Ask a question"
        />
      </DashboardRow>

      {(backendFeatures.learningProgress || homeMockMode) && (
        <div className={homeStyles.dashboard}>
          <BareActProgress />
          <ContinueLearning />
        </div>
      )}
    </div>
  );
}
