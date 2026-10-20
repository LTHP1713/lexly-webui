import { Link } from 'react-router-dom';
import { listAudit } from '@/api/audit';
import { listCollegeUsers } from '@/api/collegeUsers';
import { listSubjects } from '@/api/subjects';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import {
  ActionCard,
  DashboardHeader,
  DashboardRow,
  DashboardSection,
  HeroCard,
  Placard,
  PlacardGroup,
  SegmentBar,
} from '@/components/dashboard/Dashboard';
import { cardState, type CardState } from '@/components/dashboard/cardState';
import { HomeTable } from '@/components/dashboard/HomeTable';
import { LayersIcon, UserIcon, UsersIcon } from '@/components/icons/Icons';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatCount, formatInstant, formatListInstant } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { actionLabel, auditActor, auditSummary } from '@/pages/audit/auditFormat';
import dash from '@/components/dashboard/Dashboard.module.css';
import styles from '@/components/ui.module.css';

const COUNT_QUERY = { page: 0, size: 1 } as const;
const ACTIVITY_DAYS = 7;

/** Initials of an audit action ("User imported" → "UI") for the row chip. */
function actionChip(label: string): string {
  return label
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * `/college`: the C_ADMIN **Overview** (UI spec UR.3). People and subjects at the admin's own
 * college (the server scopes every call), the last week's audit entries and an Import users card.
 * The college's name is in the shell's top bar.
 */
export function CollegeHomePage() {
  const { user } = useAuth();
  const students = useCachedQuery(queryKeys.collegeUsers.list({ role: 'C_STUDENT', ...COUNT_QUERY }), (signal) =>
    listCollegeUsers({ role: 'C_STUDENT', ...COUNT_QUERY }, signal),
  );
  const professors = useCachedQuery(queryKeys.collegeUsers.list({ role: 'C_PROFESSOR', ...COUNT_QUERY }), (signal) =>
    listCollegeUsers({ role: 'C_PROFESSOR', ...COUNT_QUERY }, signal),
  );
  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  // From the start of the day a week ago, so the key stays the same all day.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (ACTIVITY_DAYS - 1));
  const activityQuery = { from: since.toISOString(), page: 0, size: 5 };
  const activity = useCachedQuery(queryKeys.audit.list({ scope: 'home', ...activityQuery }), () => listAudit(activityQuery));

  const studentCount = students.status === 'success' ? students.data.totalElements : 0;
  const professorCount = professors.status === 'success' ? professors.data.totalElements : 0;
  // The hero needs both counts: either failing shows its error, otherwise it waits for both.
  const peopleState: CardState =
    students.status === 'error'
      ? cardState(students)
      : professors.status === 'error'
        ? cardState(professors)
        : students.status === 'success' && professors.status === 'success'
          ? { status: 'ready' }
          : { status: 'loading' };

  return (
    <div className={dash.page}>
      <DashboardHeader eyebrow={user?.college ? undefined : 'College admin'} title="Overview" />

      <DashboardRow>
        <HeroCard
          id="home-people"
          title="People at your college"
          value={formatCount(studentCount + professorCount)}
          action={{ to: '/college/users', label: 'All users' }}
          state={peopleState}
        >
          <SegmentBar
            label={`${formatCount(studentCount)} students, ${formatCount(professorCount)} professors`}
            segments={[
              { value: studentCount, label: `${formatCount(studentCount)} students`, tone: 'blue' },
              { value: professorCount, label: `${formatCount(professorCount)} professors`, tone: 'ink' },
            ]}
            legend
          />
        </HeroCard>

        <PlacardGroup id="home-manage" title="Manage">
          <Placard
            to="/college/users"
            tone="lavender"
            value={formatCount(studentCount)}
            label="Students"
            action="Open"
            icon={UserIcon}
            state={cardState(students)}
          />
          <Placard
            to="/college/users?role=professors"
            tone="mint"
            value={formatCount(professorCount)}
            label="Professors"
            action="Open"
            icon={UsersIcon}
            state={cardState(professors)}
          />
          <Placard
            to="/college/subjects"
            tone="cream"
            value={subjects.status === 'success' ? formatCount(subjects.data.length) : ''}
            label="Subjects"
            action="Open"
            icon={LayersIcon}
            state={cardState(subjects)}
          />
        </PlacardGroup>
      </DashboardRow>

      <DashboardRow>
        <DashboardSection id="home-activity" title="Recent activity" more={{ to: '/college/audit', label: 'Audit log' }}>
          {activity.status === 'loading' && <LoadingState label="Loading recent activity" lines={3} />}
          {activity.status === 'error' && <ErrorState error={activity.error} onRetry={activity.retry} />}
          {activity.status === 'success' &&
            (activity.data.content.length === 0 ? (
              <EmptyState>Nothing has been recorded in the last {ACTIVITY_DAYS} days.</EmptyState>
            ) : (
              <HomeTable
                caption="Recent audit entries"
                rows={activity.data.content}
                rowKey={(event) => event.id}
                leadHeader="Action"
                lead={(event) => {
                  const label = actionLabel(event.action) ?? event.action;
                  return { chip: actionChip(label), title: label };
                }}
                columns={[
                  { header: 'By', cell: (event) => auditActor(event) },
                  { header: 'Details', cell: (event) => auditSummary(event) || '—' },
                  {
                    header: 'When',
                    cell: (event) => <span title={formatInstant(event.createdAt)}>{formatListInstant(event.createdAt)}</span>,
                  },
                ]}
              />
            ))}
        </DashboardSection>

        <ActionCard
          id="home-import"
          before="Add a whole"
          pill="batch"
          after="at once"
          text="Import students or professors from a CSV or Excel file. Each row is checked and the result shown row by row."
          to="/college/users/import"
          label="Import users"
        />
      </DashboardRow>
      <p className={styles.hint}>
        Need a single account? <Link to="/college/users">Add a user</Link> from the Users page.
      </p>
    </div>
  );
}
