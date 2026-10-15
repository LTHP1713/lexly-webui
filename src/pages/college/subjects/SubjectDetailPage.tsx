import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { hasCode } from '@/api/errors';
import { getSubject, type Subject } from '@/api/subjects';
import { flash } from '@/components/flash';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatCount, formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { DeleteSubjectDialog, ManageProfessorsDialog, SubjectFormDialog } from './subjectDialogs';
import styles from '@/components/ui.module.css';

/** `/college/subjects/:subjectId` (UI spec F2.7). Another college's subject is a `404` → Not Found. */
export function SubjectDetailPage() {
  const { subjectId = '' } = useParams();
  const query = useCachedQuery(queryKeys.subjects.detail(subjectId), (signal) => getSubject(subjectId, signal));

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  const subject = query.status === 'success' ? query.data : null;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/college/subjects">Subjects</Link>
        {subject && <span aria-current="page"> / {subject.code}</span>}
      </nav>
      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading subject…</h1>
          <LoadingState label="Loading subject" />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Subject unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {subject && <SubjectDetail subject={subject} />}
    </>
  );
}

function SubjectDetail({ subject }: { subject: Subject }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{subject.name}</h1>
            <p className={styles.detailFacts}>
              <span className={styles.codeChip}>{subject.code}</span>
              <span>
                {formatCount(subject.assessmentCount)} {subject.assessmentCount === 1 ? 'assessment' : 'assessments'}
              </span>
              <span>Updated {formatDate(subject.updatedAt)}</span>
            </p>
          </div>
          <div className={styles.headerLinks}>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className={styles.dangerButton} onClick={() => setDeleting(true)}>
              Delete
            </button>
          </div>
        </div>
        {subject.description && <p className={styles.preLine}>{subject.description}</p>}
      </header>

      <section className={`${styles.editorSection} ${styles.listSection}`} aria-labelledby="subject-professors-title">
        <div className={styles.sectionHead}>
          <h2 id="subject-professors-title" className={styles.sectionHeadTitle}>
            Professors
          </h2>
          {subject.professors.length > 0 && (
            <button type="button" className={styles.secondaryButton} onClick={() => setManaging(true)}>
              Manage professors
            </button>
          )}
        </div>
        {subject.professors.length === 0 ? (
          <EmptyState
            actions={
              <button type="button" className={styles.primaryButton} onClick={() => setManaging(true)}>
                Assign professors
              </button>
            }
          >
            No professors yet. Only the professors assigned here can create assessments for this subject.
          </EmptyState>
        ) : (
          <ul className={styles.plainList}>
            {subject.professors.map((professor) => (
              <li key={professor.id}>
                <Link to={`/college/users/${professor.id}`}>{professor.fullName ?? 'Unnamed professor'}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SubjectFormDialog
        open={editing}
        subject={subject}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          flash('Subject updated.');
        }}
      />
      <ManageProfessorsDialog
        open={managing}
        subject={subject}
        onClose={() => setManaging(false)}
        onSaved={() => {
          setManaging(false);
          flash('Professors updated.');
        }}
      />
      <DeleteSubjectDialog
        subject={subject}
        open={deleting}
        onClose={() => setDeleting(false)}
        onRename={() => setEditing(true)}
        onDeleted={() => {
          flash(`${subject.name} deleted.`);
          navigate('/college/subjects');
        }}
      />
    </>
  );
}
