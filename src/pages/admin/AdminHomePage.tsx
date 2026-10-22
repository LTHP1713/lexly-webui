import { Link } from 'react-router-dom';
import { listColleges } from '@/api/colleges';
import { getAiUsageDaily, listIndexRuns, type TutorIndexRun } from '@/api/tutor';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import {
  ActionCard,
  DashboardHeader,
  DashboardRow,
  DashboardSection,
  HeroCard,
  Placard,
  PlacardGroup,
  Sparkline,
} from '@/components/dashboard/Dashboard';
import { cardState } from '@/components/dashboard/cardState';
import { HomeTable } from '@/components/dashboard/HomeTable';
import { CourthouseIcon, RefreshIcon, UsersIcon } from '@/components/icons/Icons';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatCount } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { defaultRange, formatShortDate } from '@/pages/admin/tutor/spendRange';
import { formatDuration, formatUsd } from '@/pages/tutor/tutorFormat';
import dash from '@/components/dashboard/Dashboard.module.css';
import styles from '@/components/ui.module.css';

/** The same query as the college filters, so the list is shared in the cache. */
const COLLEGES_QUERY = { page: 0, size: 100, sort: 'name,asc' } as const;
const ACTIVE_QUERY = { page: 0, size: 1, sort: 'name,asc', active: true } as const;

const RUN_LABELS: Record<TutorIndexRun['status'], string> = {
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
};

function runDuration(run: TutorIndexRun): string {
  if (!run.startedAt || !run.finishedAt) return 'in progress';
  return formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime());
}

/**
 * `/admin`: the SUPERADMIN **Overview** (UI spec UR.3). AI spend for the last 30 days, colleges and
 * people across them, the tutor's last index run, the colleges table and a Re-index card. Every
 * number comes from an existing endpoint; each card loads and fails on its own.
 */
export function AdminHomePage() {
  const range = defaultRange();
  const usage = useCachedQuery(queryKeys.tutor.usage({ from: range.from, to: range.to, collegeId: '', role: null }), (signal) =>
    getAiUsageDaily(range, signal),
  );
  const colleges = useCachedQuery(queryKeys.colleges.list(COLLEGES_QUERY), () => listColleges(COLLEGES_QUERY));
  const active = useCachedQuery(queryKeys.colleges.list(ACTIVE_QUERY), () => listColleges(ACTIVE_QUERY));
  const runs = useCachedQuery(queryKeys.tutor.indexRuns, (signal) => listIndexRuns(signal));

  const collegeList = colleges.status === 'success' ? colleges.data.content : [];
  const students = collegeList.reduce((sum, c) => sum + c.counts.students, 0);
  const professors = collegeList.reduce((sum, c) => sum + c.counts.professors, 0);
  const partial = colleges.status === 'success' && colleges.data.totalElements > collegeList.length;
  const lastRun = runs.status === 'success' ? (runs.data[0] ?? null) : null;
  const spend = usage.status === 'success' ? usage.data : null;

  return (
    <div className={dash.page}>
      <DashboardHeader eyebrow="Super admin" title="Overview" />

      <DashboardRow>
        <HeroCard
          id="home-spend"
          title="AI spend · last 30 days"
          value={spend ? formatUsd(spend.totals.cost) : undefined}
          sub={
            spend &&
            `${formatCount(spend.totals.questions)} tutor ${spend.totals.questions === 1 ? 'question' : 'questions'} · ${formatCount(spend.totals.indexRuns)} index ${spend.totals.indexRuns === 1 ? 'run' : 'runs'}`
          }
          action={{ to: '/admin/tutor?tab=spend', label: 'Open spend' }}
          state={cardState(usage)}
        >
          {spend && spend.days.length > 0 && (
            <>
              <Sparkline
                values={spend.days.map((d) => d.cost)}
                label={`Daily AI cost from ${formatShortDate(spend.from)} to ${formatShortDate(spend.to)}`}
              />
              <div className={dash.axisRow} aria-hidden="true">
                <span>{formatShortDate(spend.from)}</span>
                <span>{formatShortDate(spend.to)}</span>
              </div>
            </>
          )}
        </HeroCard>

        <PlacardGroup id="home-platform" title="Your platform">
          <Placard
            to="/admin/colleges"
            tone="lavender"
            value={active.status === 'success' ? formatCount(active.data.totalElements) : ''}
            label="Active colleges"
            action="Colleges"
            icon={CourthouseIcon}
            state={cardState(active)}
          />
          <Placard
            to="/admin/colleges"
            tone="mint"
            value={`${formatCount(students)}${partial ? '+' : ''}`}
            label={`Students · ${formatCount(professors)}${partial ? '+' : ''} professors`}
            action="Across colleges"
            icon={UsersIcon}
            state={cardState(colleges)}
          />
          <Placard
            to="/admin/tutor"
            tone="cream"
            value={lastRun ? RUN_LABELS[lastRun.status] : 'Not indexed'}
            label={lastRun ? `Last index run · ${runDuration(lastRun)}` : 'The tutor needs a first index run'}
            action="Tutor index"
            icon={RefreshIcon}
            state={cardState(runs)}
          />
        </PlacardGroup>
      </DashboardRow>

      <DashboardRow>
        <DashboardSection id="home-colleges" title="Colleges" more={{ to: '/admin/colleges', label: 'All colleges' }}>
          {colleges.status === 'loading' && <LoadingState label="Loading colleges" lines={3} />}
          {colleges.status === 'error' && <ErrorState error={colleges.error} onRetry={colleges.retry} />}
          {colleges.status === 'success' &&
            (collegeList.length === 0 ? (
              <EmptyState
                actions={
                  <Link to="/admin/colleges" className={styles.primaryButton}>
                    Add a college
                  </Link>
                }
              >
                No colleges yet.
              </EmptyState>
            ) : (
              <HomeTable
                caption="Colleges, first 3 by name"
                rows={collegeList.slice(0, 3)}
                rowKey={(c) => c.id}
                leadHeader="College"
                lead={(c) => ({
                  chip: c.code.slice(0, 3),
                  title: c.name,
                  to: `/admin/colleges/${encodeURIComponent(c.id)}`,
                  sub: c.code,
                })}
                columns={[
                  { header: 'Students', numeric: true, strong: true, cell: (c) => formatCount(c.counts.students) },
                  { header: 'Professors', numeric: true, cell: (c) => formatCount(c.counts.professors) },
                  { header: 'Admins', numeric: true, cell: (c) => formatCount(c.counts.admins) },
                  {
                    header: 'Status',
                    cell: (c) => (
                      <StatusBadge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Active' : 'Inactive'}</StatusBadge>
                    ),
                  },
                ]}
              />
            ))}
        </DashboardSection>

        <ActionCard
          ai
          id="home-reindex"
          before="Keep the"
          pill="tutor"
          after="up to date"
          text="Re-index after adding acts, case laws or study PDFs so answers cite the latest sources."
          to="/admin/tutor"
          label="Re-index"
        />
      </DashboardRow>
    </div>
  );
}

