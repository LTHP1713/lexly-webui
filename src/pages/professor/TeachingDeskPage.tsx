import { Link } from 'react-router-dom';
import { listAssessments, type AssessmentSummary } from '@/api/professor';
import { useAuth } from '@/auth/AuthContext';
import { AssessmentStatusBadge } from '@/components/AssessmentBadges';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import {
  ActionCard,
  DashboardHeader,
  DashboardRow,
  DashboardSection,
  HeroCard,
  Legend,
  Placard,
  PlacardGroup,
  SegmentBar,
} from '@/components/dashboard/Dashboard';
import { cardState } from '@/components/dashboard/cardState';
import { HomeTable } from '@/components/dashboard/HomeTable';
import { ChecklistIcon, ClockIcon, PenIcon } from '@/components/icons/Icons';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { timeLeft, useNow } from '@/lib/deadline';
import { formatCount, formatInstant } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import dash from '@/components/dashboard/Dashboard.module.css';
import styles from '@/components/ui.module.css';

/** Enough of the newest assessments to cover a term; the list screen pages through the rest. */
const HOME_QUERY = { page: 0, size: 50 } as const;

function assessmentLink(a: Pick<AssessmentSummary, 'id' | 'status'>): string {
  const base = `/professor/assessments/${encodeURIComponent(a.id)}`;
  return a.status === 'DRAFT' ? `${base}/edit` : base;
}

/**
 * `/professor`: the professor's **Teaching desk** (UI spec UR.3), from `GET /professor/assessments`
 * counts only: grading progress, answers to grade, open assessments, the next due date, the
 * newest assessments and a New assessment card. The full list is `/professor/assessments`.
 */
export function TeachingDeskPage() {
  const { user } = useAuth();
  const now = useNow();
  const list = useCachedQuery(queryKeys.professorAssessments.list(HOME_QUERY), (signal) => listAssessments(HOME_QUERY, signal));
  const assessments = list.status === 'success' ? list.data.content : [];
  const state = cardState(list);

  const live = assessments.filter((a) => a.status !== 'DRAFT' && a.status !== 'REMOVED');
  const submitted = live.reduce((sum, a) => sum + a.counts.submitted, 0);
  const published = live.reduce((sum, a) => sum + a.counts.published, 0);
  const toGrade = live.reduce((sum, a) => sum + a.counts.pendingEvaluation, 0);
  const firstToGrade = live.find((a) => a.counts.pendingEvaluation > 0);
  const open = assessments.filter((a) => a.status === 'PUBLISHED');
  const nextDue = open
    .filter((a) => a.dueAt && new Date(a.dueAt).getTime() > now)
    .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())[0];
  const progressRows = live.filter((a) => a.counts.submitted > 0).slice(0, 3);

  return (
    <div className={dash.page}>
      <DashboardHeader eyebrow={user?.fullName ? `Hi ${user.fullName}` : undefined} title="Teaching desk" />

      <DashboardRow>
        <HeroCard
          id="home-grading"
          title="Grading progress"
          value={submitted > 0 ? `${formatCount(published)} of ${formatCount(submitted)} published` : 'Nothing to grade yet'}
          sub={submitted > 0 ? undefined : 'Answers appear here once students submit them.'}
          state={state}
        >
          {progressRows.map((a) => (
            <div key={a.id} className={dash.barRow}>
              <div className={dash.barRowHead}>
                <span>{a.title}</span>
                <span>
                  {formatCount(a.counts.published)} published · {formatCount(a.counts.pendingEvaluation)} to grade
                </span>
              </div>
              <SegmentBar
                label={`${a.title}: ${a.counts.published} published, ${a.counts.pendingEvaluation} to grade`}
                segments={[
                  { value: a.counts.published, label: 'Published', tone: 'blue' },
                  { value: a.counts.pendingEvaluation, label: 'To grade', tone: 'ink' },
                ]}
              />
            </div>
          ))}
          {progressRows.length > 0 && (
            <Legend
              items={[
                { label: 'Published', tone: 'blue' },
                { label: 'To grade', tone: 'ink' },
              ]}
            />
          )}
        </HeroCard>

        <PlacardGroup id="home-today" title="Today">
          <Placard
            to={firstToGrade ? assessmentLink(firstToGrade) : '/professor/assessments'}
            tone="lavender"
            value={formatCount(toGrade)}
            label="Answers to grade"
            action={firstToGrade ? 'Start grading' : 'Assessments'}
            icon={PenIcon}
            state={state}
          />
          <Placard
            to="/professor/assessments?status=PUBLISHED"
            tone="mint"
            value={formatCount(open.length)}
            label="Open assessments"
            action="Assessments"
            icon={ChecklistIcon}
            state={state}
          />
          <Placard
            to={nextDue ? assessmentLink(nextDue) : '/professor/assessments'}
            tone="cream"
            value={nextDue ? (timeLeft(nextDue.dueAt, now)?.text.replace(/^in /, '') ?? '—') : 'None'}
            label={nextDue ? `Next due · ${nextDue.title}` : 'No open due dates'}
            action={nextDue ? 'Submissions' : 'Assessments'}
            icon={ClockIcon}
            state={state}
          />
        </PlacardGroup>
      </DashboardRow>

      <DashboardRow>
        <DashboardSection id="home-assessments" title="Your assessments" more={{ to: '/professor/assessments', label: 'All assessments' }}>
          {list.status === 'loading' && <LoadingState label="Loading your assessments" lines={3} />}
          {list.status === 'error' && <ErrorState error={list.error} onRetry={list.retry} />}
          {list.status === 'success' &&
            (assessments.length === 0 ? (
              <EmptyState
                title="Nothing on the docket yet."
                actions={
                  <Link to="/professor/assessments/new" className={styles.primaryButton}>
                    New assessment
                  </Link>
                }
              >
                You haven&rsquo;t created any assessments yet.
              </EmptyState>
            ) : (
              <HomeTable
                caption="Your newest assessments"
                rows={assessments.slice(0, 3)}
                rowKey={(a) => a.id}
                leadHeader="Assessment"
                lead={(a) => ({
                  chip: a.subject.code.slice(0, 3) || '—',
                  title: a.title || 'Untitled assessment',
                  to: assessmentLink(a),
                  sub: `${a.subject.code} · ${a.subject.name}`,
                })}
                columns={[
                  { header: 'Due', cell: (a) => (a.dueAt ? formatInstant(a.dueAt) : 'Not set') },
                  {
                    header: 'Submitted',
                    numeric: true,
                    cell: (a) =>
                      a.status === 'DRAFT' ? '—' : `${formatCount(a.counts.submitted)} of ${formatCount(a.counts.answerSlots)}`,
                  },
                  {
                    header: 'To grade',
                    numeric: true,
                    strong: true,
                    cell: (a) => (a.status === 'DRAFT' ? '—' : formatCount(a.counts.pendingEvaluation)),
                  },
                  { header: 'Status', cell: (a) => <AssessmentStatusBadge status={a.status} /> },
                ]}
              />
            ))}
        </DashboardSection>

        <ActionCard
          id="home-new"
          before="Set the next"
          pill="problem"
          text="Draft questions with marks and word limits, then publish to every student in the subject."
          to="/professor/assessments/new"
          label="New assessment"
        />
      </DashboardRow>
    </div>
  );
}
