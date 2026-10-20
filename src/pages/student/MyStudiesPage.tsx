import { Link } from 'react-router-dom';
import { listStudentAssessments, type StudentAssessmentSummary } from '@/api/student';
import { getTutorQuota } from '@/api/tutor';
import { useAuth } from '@/auth/AuthContext';
import { StudentStateBadge } from '@/components/AssessmentBadges';
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
import { cardState } from '@/components/dashboard/cardState';
import { HomeTable } from '@/components/dashboard/HomeTable';
import { ChatIcon, CheckIcon, ChecklistIcon } from '@/components/icons/Icons';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { timeLeft, useNow } from '@/lib/deadline';
import { formatCount, formatInstant } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import dash from '@/components/dashboard/Dashboard.module.css';

const HOME_QUERY = { page: 0, size: 50 } as const;

const isOpen = (a: StudentAssessmentSummary) => a.state === 'OPEN' || a.state === 'PARTIALLY_SUBMITTED';
const dueTime = (a: StudentAssessmentSummary) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY);

/**
 * `/student`: the college student's **My studies** (UI spec UR.3). The assessment due next with
 * its answer progress, open assessments, published results, tutor questions left today, the
 * assessments by due date and an Ask the tutor card. The full list is `/student/assessments`.
 */
export function MyStudiesPage() {
  const { user } = useAuth();
  const now = useNow();
  const list = useCachedQuery(queryKeys.studentAssessments.list(HOME_QUERY), (signal) =>
    listStudentAssessments(HOME_QUERY, signal),
  );
  const quota = useCachedQuery(queryKeys.tutor.quota, (signal) => getTutorQuota(signal));
  const assessments = list.status === 'success' ? list.data.content : [];
  const state = cardState(list);

  const open = assessments.filter(isOpen);
  const withResults = assessments.filter((a) => a.progress.resultsPublished > 0);
  const next = open.filter((a) => dueTime(a) > now).sort((a, b) => dueTime(a) - dueTime(b))[0];
  const byDue = [...assessments].sort((a, b) => {
    // Open ones first (soonest due), then the rest (latest first).
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    return isOpen(a) ? dueTime(a) - dueTime(b) : dueTime(b) - dueTime(a);
  });
  const left = next ? timeLeft(next.dueAt, now) : null;
  const notUploaded = next ? Math.max(0, next.questionCount - next.progress.submitted - next.progress.uploaded) : 0;

  const context = [user?.firstName && `Hi ${user.firstName}`, user?.loginId && `Roll no. ${user.loginId}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={dash.page}>
      <DashboardHeader eyebrow={context || undefined} title="My studies" />

      <DashboardRow>
        <HeroCard
          id="home-next"
          title="Due next"
          value={next ? next.title || 'Untitled assessment' : 'Nothing due'}
          sub={
            next
              ? `${next.subject.code} · ${next.subject.name}${next.professorName ? ` · ${next.professorName}` : ''}`
              : 'You have no open assessments right now.'
          }
          state={state}
        >
          {next && (
            <>
              <p className={dash.heroNote}>
                <strong>Due {left?.text ?? formatInstant(next.dueAt)}</strong> · {formatInstant(next.dueAt)}
              </p>
              <div className={dash.barRow}>
                <div className={dash.barRowHead}>
                  <span>
                    {formatCount(next.progress.submitted)} of {formatCount(next.questionCount)} answers submitted
                  </span>
                  <span>{next.progress.uploaded > 0 ? `${formatCount(next.progress.uploaded)} uploaded, not submitted` : ''}</span>
                </div>
                <SegmentBar
                  label={`${next.progress.submitted} submitted, ${next.progress.uploaded} uploaded, ${notUploaded} not uploaded`}
                  segments={[
                    { value: next.progress.submitted, label: 'Submitted', tone: 'blue' },
                    { value: next.progress.uploaded, label: 'Uploaded', tone: 'grey' },
                  ]}
                />
              </div>
              <Link to={`/student/assessments/${encodeURIComponent(next.id)}`} className={dash.heroButton}>
                Continue answering →
              </Link>
            </>
          )}
        </HeroCard>

        <PlacardGroup id="home-glance" title="At a glance">
          <Placard
            to="/student/assessments"
            tone="lavender"
            value={formatCount(open.length)}
            label="Open assessments"
            action="Open"
            icon={ChecklistIcon}
            state={state}
          />
          <Placard
            to={withResults.length === 1 ? `/student/assessments/${encodeURIComponent(withResults[0].id)}/results` : '/student/assessments'}
            tone="mint"
            value={formatCount(withResults.length)}
            label="With results published"
            action="Results"
            icon={CheckIcon}
            state={state}
          />
          <Placard
            to="/tutor"
            tone="cream"
            value={quota.status === 'success' ? `${formatCount(quota.data.remaining)} of ${formatCount(quota.data.limit)}` : ''}
            label="Tutor questions left today"
            action="Tutor"
            icon={ChatIcon}
            state={cardState(quota)}
          />
        </PlacardGroup>
      </DashboardRow>

      <DashboardRow>
        <DashboardSection id="home-assessments" title="Assessments" more={{ to: '/student/assessments', label: 'All assessments' }}>
          {list.status === 'loading' && <LoadingState label="Loading your assessments" lines={3} />}
          {list.status === 'error' && <ErrorState error={list.error} onRetry={list.retry} />}
          {list.status === 'success' &&
            (assessments.length === 0 ? (
              <EmptyState>No assessments yet. They appear here when your professors publish them.</EmptyState>
            ) : (
              <HomeTable
                caption="Your assessments, open ones first"
                rows={byDue.slice(0, 5)}
                rowKey={(a) => a.id}
                leadHeader="Assessment"
                lead={(a) => ({
                  chip: a.subject.code.slice(0, 3) || '—',
                  title: a.title || 'Untitled assessment',
                  to: `/student/assessments/${encodeURIComponent(a.id)}`,
                  sub: `${a.subject.code} · ${a.subject.name}`,
                })}
                columns={[
                  { header: 'Due', cell: (a) => formatInstant(a.dueAt) },
                  {
                    header: 'Submitted',
                    numeric: true,
                    cell: (a) => `${formatCount(a.progress.submitted)} of ${formatCount(a.questionCount)}`,
                  },
                  { header: 'Status', cell: (a) => <StudentStateBadge state={a.state} /> },
                ]}
              />
            ))}
        </DashboardSection>

        <ActionCard
          id="home-ask"
          before="Stuck on a"
          pill="section"
          after="? Ask the tutor"
          text="Answers come from Lexly's library and cite the sections and case laws they use."
          to="/tutor"
          label="Ask a question"
        />
      </DashboardRow>
    </div>
  );
}
