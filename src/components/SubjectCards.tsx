import { listSubjects, type Subject } from '@/api/subjects';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { queryKeys } from '@/lib/queryClient';
import styles from './SubjectCards.module.css';

/**
 * Read-only subjects on the professor and student homes (UI spec F2.8) until F3 turns them into
 * assessment filters. The server already scopes the list: a professor gets only the subjects
 * they are mapped to, a student every subject of their college.
 */
export function SubjectCards({
  title,
  emptyText,
  showProfessors,
}: {
  title: string;
  emptyText: string;
  /** Professors see who else teaches a shared subject ("With …"). */
  showProfessors: boolean;
}) {
  const { user } = useAuth();
  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));

  return (
    <section className={styles.section} aria-labelledby="subject-cards-title">
      <h2 id="subject-cards-title" className={styles.heading}>
        {title}
      </h2>
      {subjects.status === 'loading' && <LoadingState label="Loading subjects" lines={2} />}
      {subjects.status === 'error' && <ErrorState error={subjects.error} onRetry={subjects.retry} />}
      {subjects.status === 'success' &&
        (subjects.data.length === 0 ? (
          <EmptyState>{emptyText}</EmptyState>
        ) : (
          <ul className={styles.grid}>
            {subjects.data.map((subject) => (
              <li key={subject.id}>
                <SubjectCard subject={subject} others={showProfessors ? otherProfessors(subject, user?.id) : []} />
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

function otherProfessors(subject: Subject, myId: string | undefined): string[] {
  return subject.professors.filter((p) => p.id !== myId).map((p) => p.fullName ?? 'another professor');
}

function SubjectCard({ subject, others }: { subject: Subject; others: string[] }) {
  return (
    <article className={styles.card}>
      <h3 className={styles.name}>{subject.name}</h3>
      <span className={styles.code}>{subject.code}</span>
      {subject.description && (
        <p className={styles.description} title={subject.description}>
          {subject.description}
        </p>
      )}
      {others.length > 0 && <p className={styles.with}>With {others.join(', ')}</p>}
    </article>
  );
}
