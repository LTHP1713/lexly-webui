import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { ImportResult, ImportRow } from '@/api/bulkImport';
import {
  USER_IMPORT_LIMITS,
  checkUserImportFile,
  importCollegeUsers,
  toUserKind,
  type CollegeUserKind,
} from '@/api/collegeUsers';
import { errorMessage, hasCode } from '@/api/errors';
import { FileDropzone } from '@/components/FileDropzone';
import { flash } from '@/components/flash';
import { ImportResultTable } from '@/components/ImportResultTable';
import { UsersSubNav } from '@/components/SubNav';
import { formatCount } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import styles from '@/components/ui.module.css';

const KINDS: readonly CollegeUserKind[] = ['students', 'professors'];
const KIND_LABELS: Record<CollegeUserKind, string> = { students: 'Students', professors: 'Professors' };
const TOO_LARGE = 'This file is larger than 5 MB. Split it into smaller files.';

const CONVERTED_NOTE =
  'Their personal Lexly account was converted to a student account here. Their solo practice data was deleted, and their password is now their roll no.';

type Phase = { step: 'idle' } | { step: 'uploading'; percent: number } | { step: 'checking' };

interface Outcome {
  id: number;
  kind: CollegeUserKind;
  result: ImportResult;
}

/**
 * `/college/users/import` (UI spec F2.6): a students or professors spreadsheet in, one outcome
 * per row out. Row numbers are the spreadsheet's (the header is row 1), as the server sends them.
 */
export function UsersImportPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const kind = toUserKind(params.get('kind'));
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const sending = phase.step !== 'idle';
  const idColumn = kind === 'students' ? 'roll_no' : 'employee_id';
  const idNoun = kind === 'students' ? 'roll no' : 'employee ID';

  function chooseKind(next: CollegeUserKind) {
    setParams(next === 'students' ? {} : { kind: next }, { replace: true });
    setBanner(null);
    setOutcome(null);
  }

  function chooseFile(next: File) {
    setBanner(null);
    const problem = checkUserImportFile(next);
    setFile(problem ? null : next);
    setFileError(problem);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setBanner(null);
    if (!file) {
      setFileError('Choose a .csv or .xlsx file.');
      document.getElementById('import-file')?.focus();
      return;
    }
    setFileError(null);
    setPhase({ step: 'uploading', percent: 0 });
    try {
      const result = await importCollegeUsers(kind, file, {
        onProgress: (fraction) =>
          setPhase(fraction >= 1 ? { step: 'checking' } : { step: 'uploading', percent: Math.round(fraction * 100) }),
      });
      setOutcome({ id: Date.now(), kind, result });
      const { created, converted, total } = result.summary;
      if (created + converted > 0) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.collegeUsers.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.subjects.all });
      }
      if (total > 0 && created + converted === total) flash(`${formatCount(total)} users imported.`);
    } catch (err) {
      setOutcome(null);
      if (hasCode(err, 'IMPORT_FILE_INVALID')) {
        setFileError(`This file can't be imported: ${err.message}`);
      } else if (hasCode(err, 'VALIDATION_ERROR') && /^file\b/.test(err.message)) {
        setFileError(TOO_LARGE);
      } else {
        setBanner(errorMessage(err));
      }
    } finally {
      setPhase({ step: 'idle' });
    }
  }

  const summary = outcome?.result.summary;
  const problems = summary ? summary.rejected + summary.failed : 0;
  const students = outcome?.kind === 'students';

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>College admin</p>
          <h1 className={styles.title}>Import users</h1>
        </div>
      </div>
      <UsersSubNav />

      <form className={styles.form} noValidate onSubmit={(event) => void handleSubmit(event)}>
        <section className={styles.editorSection} aria-label="File">
          <fieldset className={`${styles.field} ${styles.plainFieldset}`}>
            <legend className={styles.label}>Kind</legend>
            <div className={styles.segmented}>
              {KINDS.map((value) => (
                <label key={value} className={styles.segmentOption}>
                  <input
                    type="radio"
                    name="import-kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => chooseKind(value)}
                    disabled={sending}
                  />
                  <span>{KIND_LABELS[value]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.field}>
            <p className={styles.label}>
              Start from a template:{' '}
              <a href={`/templates/${kind}.csv`} download>
                CSV<span className={styles.visuallyHidden}> template for {kind}</span>
              </a>{' '}
              ·{' '}
              <a href={`/templates/${kind}.xlsx`} download>
                Excel<span className={styles.visuallyHidden}> template for {kind}</span>
              </a>
            </p>
            <p className={styles.hint}>
              Row 1 must be the header full_name, email, {idColumn} (any order). Up to{' '}
              {formatCount(USER_IMPORT_LIMITS.maxRows)} rows and 5 MB. Each {kind === 'students' ? 'student' : 'professor'}
              &rsquo;s first password is their {idNoun}.
            </p>
          </div>

          <FileDropzone
            id="import-file"
            label="File"
            prompt="Choose a CSV or Excel file, or drop it here"
            accept=".csv,.xlsx"
            file={file}
            error={fileError}
            disabled={sending}
            onFile={chooseFile}
            onRemove={() => {
              setFile(null);
              setFileError(null);
            }}
          />

          {phase.step !== 'idle' && (
            <div className={styles.field} aria-live="polite">
              <label htmlFor="import-progress" className={styles.label}>
                {phase.step === 'uploading' ? `Uploading… ${phase.percent}%` : 'Checking rows…'}
              </label>
              {phase.step === 'uploading' ? (
                <progress id="import-progress" max={100} value={phase.percent} />
              ) : (
                <progress id="import-progress" />
              )}
            </div>
          )}
        </section>

        <div role="alert">{banner && <p className={styles.formError}>{banner}</p>}</div>

        <div className={styles.saveBar}>
          <button type="submit" className={styles.primaryButton} disabled={sending || !file}>
            {sending ? 'Importing…' : 'Import'}
          </button>
        </div>
      </form>

      {outcome && summary && (
        <section className={`${styles.editorSection} ${styles.listSection}`} aria-labelledby="import-results-title">
          <h2 id="import-results-title" className={styles.editorSectionTitle}>
            Results
          </h2>
          <p className={problems === 0 ? styles.successText : undefined} aria-live="polite">
            {formatCount(summary.created)} created ·{' '}
            {students && <>{formatCount(summary.converted)} converted · </>}
            {formatCount(summary.rejected)} rejected · {formatCount(summary.failed)} failed, out of{' '}
            {formatCount(summary.total)}.
          </p>
          {problems > 0 && (
            <p className={styles.hint}>
              Fix these rows in your file and import it again. Rows already created this time will come back as rejected
              (ID already used); that&rsquo;s expected.
            </p>
          )}
          <ImportResultTable
            key={outcome.id}
            result={outcome.result}
            linkFor={(row: ImportRow) => (row.id ? `/college/users/${row.id}` : null)}
            rowNumber={(row) => row.index}
            keyLabel={outcome.kind === 'students' ? 'Roll no' : 'Employee ID'}
            rowNote={(row) => (row.status === 'CONVERTED' ? CONVERTED_NOTE : null)}
          />
        </section>
      )}
    </>
  );
}
