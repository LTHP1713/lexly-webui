import { Link, useSearchParams } from 'react-router-dom';
import { IndexTab } from './IndexTab';
import { SpendTab } from './SpendTab';
import styles from '@/components/ui.module.css';

const TABS = [
  { id: 'index', label: 'Index' },
  { id: 'spend', label: 'Spend' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/**
 * `/admin/tutor` (UI spec F5a.4, SUPERADMIN): the tutor's index runs and the daily AI spend. The
 * tab is in the URL (`?tab=index|spend`); the spend filters sit beside it.
 */
export function TutorAdminPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'spend' ? 'spend' : 'index';

  function selectTab(next: Tab) {
    // The spend filters belong to the spend tab; switching drops them.
    setParams(next === 'index' ? {} : { tab: next }, { replace: true });
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin">Administration</Link>
        <span aria-current="page"> / Tutor</span>
      </nav>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Super admin</p>
          <h1 className={styles.title}>Tutor admin</h1>
        </div>
        <Link to="/tutor" className={styles.secondaryButton}>
          Open the tutor
        </Link>
      </div>

      <div role="tablist" aria-label="Tutor admin" className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tutor-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`tutor-panel-${t.id}`}
            className={styles.tab}
            onClick={() => selectTab(t.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                const other = t.id === 'index' ? 'spend' : 'index';
                selectTab(other);
                document.getElementById(`tutor-tab-${other}`)?.focus();
              }
            }}
            tabIndex={tab === t.id ? 0 : -1}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tutor-panel-${tab}`} aria-labelledby={`tutor-tab-${tab}`}>
        {tab === 'index' ? <IndexTab /> : <SpendTab />}
      </div>
    </>
  );
}
