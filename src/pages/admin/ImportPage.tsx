import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { refreshReaderCache } from '@/api/adminContent';
import {
  IMPORT_KINDS,
  importBatch,
  isImportKind,
  parseImportSource,
  rejectedRowsEnvelope,
  unknownActShortCode,
  type ImportEnvelope,
  type ImportKind,
  type ImportResult,
  type ImportRow,
} from '@/api/bulkImport';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { ImportResultTable } from '@/components/ImportResultTable';
import { ContentSubNav } from '@/components/SubNav';
import { useToast } from '@/components/Toast';
import { formatCount } from '@/lib/format';
import styles from '@/components/ui.module.css';

const MAX_FILE_BYTES = 1024 * 1024;

const KIND_LABELS: Record<ImportKind, string> = { acts: 'Acts', sections: 'Sections', caselaws: 'Case laws' };

const KIND_HINTS: Record<ImportKind, string> = {
  acts: 'Up to 10 acts per batch.',
  sections: 'Up to 100 sections of one act per batch.',
  caselaws: 'Up to 10 case laws per batch.',
};

/** The envelope of each kind (contract §5.5), shown as a starting point. */
const EXAMPLES: Record<ImportKind, string> = {
  acts: JSON.stringify(
    { acts: [{ title: 'The Indian Contract Act, 1872', shortCode: 'ICA', description: 'An Act to define …' }] },
    null,
    2,
  ),
  sections: JSON.stringify(
    {
      actShortCode: 'ICA',
      sections: [
        {
          sectionNumber: '2',
          title: 'Interpretation-clause',
          bodyText: 'In this Act the following words …',
          illustrations: ['A offers to sell …'],
          exceptions: [],
        },
      ],
    },
    null,
    2,
  ),
  caselaws: JSON.stringify(
    {
      caseLaws: [
        {
          title: 'Mohori Bibee v. Dharmodas Ghose',
          citation: '(1903) 30 IA 114',
          court: 'Privy Council',
          importance: 'LANDMARK',
          content: { onlineSummary: 'A minor’s agreement is void.', issues: [], arguments: [] },
          sections: [{ actShortCode: 'ICA', sectionNumber: '11' }],
        },
      ],
    },
    null,
    2,
  ),
};

function linkFor(kind: ImportKind) {
  return (row: ImportRow) => {
    if (!row.id) return null;
    if (kind === 'acts') return `/admin/acts/${row.id}`;
    if (kind === 'sections') return `/admin/sections/${row.id}`;
    return `/admin/caselaws/${row.id}`;
  };
}

interface Outcome {
  id: number;
  kind: ImportKind;
  body: ImportEnvelope;
  result: ImportResult;
}

/** `/admin/import` (UI spec F1.9): paste or upload a JSON batch and see each row's outcome. */
export function ImportPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const kindParam = params.get('kind');
  const kind: ImportKind = isImportKind(kindParam) ? kindParam : 'acts';
  const [source, setSource] = useState('');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function chooseKind(next: ImportKind) {
    setParams(next === 'acts' ? {} : { kind: next }, { replace: true });
    setSourceError(null);
    setBanner(null);
    setOutcome(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBanner(null);
    if (file.size > MAX_FILE_BYTES) {
      setSourceError('This file is larger than 1 MB. Split the batch into smaller files.');
      return;
    }
    try {
      setSource(await file.text());
      setSourceError(null);
    } catch {
      setSourceError("This file couldn't be read.");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setBanner(null);
    const parsed = parseImportSource(kind, source);
    if (!parsed.ok) {
      setSourceError(parsed.error);
      document.getElementById('import-source')?.focus();
      return;
    }
    setSourceError(null);
    setSending(true);
    try {
      const result = await importBatch(kind, parsed.body);
      setOutcome({ id: Date.now(), kind, body: parsed.body, result });
      if (result.summary.created > 0) {
        refreshReaderCache({ actList: kind === 'acts' });
      }
      if (result.summary.created > 0 && result.summary.created === result.summary.total) {
        toast.show(`${formatCount(result.summary.created)} items imported.`);
      }
    } catch (err) {
      setOutcome(null);
      // A 400 means the envelope itself was rejected; its message names the problem.
      setBanner(
        err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.message
          ? `The batch was rejected: ${err.message}`
          : errorMessage(err),
      );
    } finally {
      setSending(false);
    }
  }

  function downloadRejected() {
    if (!outcome) return;
    const envelope = rejectedRowsEnvelope(outcome.kind, outcome.body, outcome.result);
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lexly-${outcome.kind}-rejected.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const summary = outcome?.result.summary;
  const problems = summary ? summary.rejected + summary.failed : 0;
  const missingAct = outcome ? unknownActShortCode(outcome.kind, outcome.body, outcome.result) : null;

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Content</p>
          <h1 className={styles.title}>Import content</h1>
        </div>
      </div>
      <ContentSubNav />

      <form className={styles.form} noValidate onSubmit={(event) => void handleSubmit(event)}>
        <section className={styles.editorSection} aria-label="Batch">
          <fieldset className={`${styles.field} ${styles.plainFieldset}`}>
            <legend className={styles.label}>Kind</legend>
            <div className={styles.segmented}>
              {IMPORT_KINDS.map((value) => (
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
            <span className={styles.hint}>{KIND_HINTS[kind]}</span>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="import-source" className={styles.label}>
              JSON
            </label>
            <span id="import-source-hint" className={styles.hint}>
              Paste the batch, or load it from a file.
            </span>
            <textarea
              id="import-source"
              className={`${styles.textarea} ${styles.codeArea}`}
              rows={14}
              value={source}
              readOnly={sending}
              spellCheck={false}
              onChange={(event) => {
                setSource(event.target.value);
                setSourceError(null);
              }}
              aria-invalid={sourceError ? true : undefined}
              aria-describedby={sourceError ? 'import-source-hint import-source-error' : 'import-source-hint'}
            />
            {sourceError && (
              <span id="import-source-error" className={styles.fieldError}>
                {sourceError}
              </span>
            )}
          </div>

          <div className={styles.headerLinks}>
            <button type="button" className={styles.secondaryButton} onClick={() => fileRef.current?.click()} disabled={sending}>
              Choose .json file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className={styles.visuallyHidden}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void handleFile(event)}
            />
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setSource(EXAMPLES[kind]);
                setSourceError(null);
              }}
              disabled={sending}
            >
              Insert an example
            </button>
          </div>
        </section>

        <div role="alert">{banner && <p className={styles.formError}>{banner}</p>}</div>

        <div className={styles.saveBar}>
          <button type="submit" className={styles.primaryButton} disabled={sending || !source.trim()}>
            {sending ? 'Importing…' : 'Import'}
          </button>
        </div>
      </form>

      {outcome && summary && (
        <section className={`${styles.editorSection} ${styles.listSection}`} aria-labelledby="import-results-title">
          <h2 id="import-results-title" className={styles.editorSectionTitle}>
            Results
          </h2>
          <p
            className={problems === 0 ? styles.successText : undefined}
            aria-live="polite"
          >
            {formatCount(summary.created)} created · {formatCount(summary.rejected)} rejected ·{' '}
            {formatCount(summary.failed)} failed, out of {formatCount(summary.total)}.
          </p>
          {missingAct && <p className={styles.notice}>No act has the short code {missingAct}.</p>}
          {problems > 0 && (
            <div className={styles.headerLinks}>
              <button type="button" className={styles.secondaryButton} onClick={downloadRejected}>
                Download rejected rows
              </button>
              <p className={styles.hint}>
                Created rows are skipped in that file, so importing it again won&rsquo;t duplicate them.
              </p>
            </div>
          )}
          <ImportResultTable key={outcome.id} result={outcome.result} linkFor={linkFor(outcome.kind)} />
        </section>
      )}
      {toast.element}
    </>
  );
}
