import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, hasCode } from '@/api/errors';
import { listIndexRuns, startIndexRun, type IndexRunStatus, type TutorIndexRun } from '@/api/tutor';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { useNow } from '@/lib/deadline';
import { formatCount, formatInstant } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { formatDuration } from '@/pages/tutor/tutorFormat';
import styles from '@/components/ui.module.css';
import adminStyles from './TutorAdmin.module.css';

/** While the latest run is running, the list is polled at this rate (contract §11a.5). */
export const POLL_MS = 5000;

const STATUS: Record<IndexRunStatus, [BadgeTone, string]> = {
  RUNNING: ['info', 'Running'],
  SUCCEEDED: ['success', 'Succeeded'],
  FAILED: ['danger', 'Failed'],
};

function RunStatus({ status }: { status: IndexRunStatus }) {
  const [tone, label] = STATUS[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function duration(run: TutorIndexRun, now: number): string {
  const start = run.startedAt ? new Date(run.startedAt).getTime() : NaN;
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  return Number.isNaN(start) ? '—' : formatDuration(end - start);
}

/**
 * Index tab (UI spec F5a.4): Re-index, the latest run and the earlier ones. The list is polled
 * every 5 s only while the newest run is `RUNNING`; React Query stops the timer on unmount.
 */
export function IndexTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const runs = useCachedQuery(queryKeys.tutor.indexRuns, (signal) => listIndexRuns(signal), {
    refetchInterval: (data) => (data?.[0]?.status === 'RUNNING' ? POLL_MS : false),
  });
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const list = runs.status === 'success' ? runs.data : runs.status === 'loading' ? runs.staleData : undefined;
  const latest = list?.[0] ?? null;
  const running = latest?.status === 'RUNNING';

  // Announce when a run this page watched finishes.
  const watched = useRef<{ id: string; running: boolean } | null>(null);
  useEffect(() => {
    if (!latest) return;
    const before = watched.current;
    if (before && before.id === latest.id && before.running && latest.status !== 'RUNNING') {
      setAnnouncement(`Re-index finished: ${STATUS[latest.status][1]}.`);
    }
    watched.current = { id: latest.id, running: latest.status === 'RUNNING' };
  }, [latest]);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const run = await startIndexRun();
      queryClient.setQueryData<TutorIndexRun[]>(queryKeys.tutor.indexRuns, (previous) =>
        [run, ...(previous ?? []).filter((r) => r.id !== run.id)].slice(0, 10),
      );
      setConfirming(false);
      toast.show('Re-index started.');
      setAnnouncement('Re-indexing… this page updates every 5 seconds.');
    } catch (err) {
      if (hasCode(err, 'INDEX_RUN_IN_PROGRESS')) {
        // Not an error: show the run that is already going.
        setConfirming(false);
        setAnnouncement('A re-index is already running.');
        void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.indexRuns });
      } else {
        setStartError(errorMessage(err));
      }
    } finally {
      setStarting(false);
    }
  }

  const reindexButton = (
    <button
      type="button"
      className={styles.primaryButton}
      disabled={running || starting}
      aria-describedby={running ? 'reindex-running' : undefined}
      onClick={() => {
        setStartError(null);
        setConfirming(true);
      }}
    >
      Re-index…
    </button>
  );

  return (
    <>
      <div className={styles.sectionHead}>
        <p className={styles.hint}>
          The tutor answers from an index of the PDF folder and the library. Re-index after changing either.
        </p>
        {reindexButton}
      </div>
      {running && (
        <p id="reindex-running" className={styles.hint}>
          A run is in progress.
        </p>
      )}
      <p role="status" aria-live="polite" className={adminStyles.liveNote}>
        {announcement}
      </p>

      {runs.status === 'loading' && !list && <LoadingState label="Loading index runs" />}
      {runs.status === 'error' && <ErrorState error={runs.error} onRetry={runs.retry} />}
      {list && list.length === 0 && (
        <EmptyState actions={reindexButton}>
          The tutor hasn&rsquo;t been indexed yet. Re-index once so it can answer from the library.
        </EmptyState>
      )}
      {latest && <LatestRun run={latest} now={now} />}
      {list && list.length > 0 && <PreviousRuns runs={list.slice(1)} now={now} />}

      <ConfirmDialog
        open={confirming}
        title="Re-index the tutor?"
        confirmLabel={starting ? 'Starting…' : 'Re-index'}
        busy={starting}
        onConfirm={() => void start()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Lexly re-reads the PDF folder and the whole library in the background. This can take several minutes.
          Unchanged passages are reused, so a re-run is cheaper than the first.
        </p>
        {startError && (
          <p role="alert" className={styles.formError}>
            {startError}
          </p>
        )}
      </ConfirmDialog>
      {toast.element}
    </>
  );
}

function LatestRun({ run, now }: { run: TutorIndexRun; now: number }) {
  return (
    <section className={adminStyles.runCard} aria-labelledby="latest-run-title">
      <div className={adminStyles.runHead}>
        <h2 id="latest-run-title" className={styles.sectionHeadTitle}>
          Latest run
        </h2>
        <RunStatus status={run.status} />
      </div>
      {run.status === 'RUNNING' && <p className={styles.hint}>Re-indexing… this page updates every 5 seconds.</p>}
      {run.status === 'FAILED' && (
        <p role="alert" className={styles.formError}>
          {run.error ?? 'The run failed.'}
        </p>
      )}
      <dl className={adminStyles.facts}>
        <div>
          <dt>Started</dt>
          <dd>
            {formatInstant(run.startedAt)} by {run.startedBy?.fullName ?? 'a removed user'}
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{run.status === 'RUNNING' ? `Running for ${duration(run, now)}` : duration(run, now)}</dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>
            {formatCount(run.files.ingested)} ingested · {formatCount(run.files.failed.length)} failed
            {run.files.failed.length > 0 && (
              <ul className={adminStyles.failedFiles} aria-label="Files that failed">
                {run.files.failed.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt>Library</dt>
          <dd>
            {formatCount(run.library.sections)} sections · {formatCount(run.library.caseLaws)} case laws
          </dd>
        </div>
        <div>
          <dt>Chunks</dt>
          <dd>
            {formatCount(run.chunks.embedded)} embedded · {formatCount(run.chunks.reused)} reused ·{' '}
            {formatCount(run.chunks.removed)} removed
          </dd>
        </div>
        <div>
          <dt>Embedding tokens</dt>
          <dd>{formatCount(run.embeddingTokens)}</dd>
        </div>
      </dl>
    </section>
  );
}

function PreviousRuns({ runs, now }: { runs: TutorIndexRun[]; now: number }) {
  const wide = useMediaQuery(TABLE_QUERY);
  return (
    <section aria-labelledby="previous-runs-title">
      <h2 id="previous-runs-title" className={styles.sectionHeadTitle}>
        Previous runs
      </h2>
      {runs.length === 0 ? (
        <p className={styles.hint}>No earlier runs.</p>
      ) : wide ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>Previous index runs, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Started</th>
                <th scope="col">Status</th>
                <th scope="col">Started by</th>
                <th scope="col">Duration</th>
                <th scope="col" className={styles.numeric}>
                  Files
                </th>
                <th scope="col" className={styles.numeric}>
                  Chunks embedded
                </th>
                <th scope="col" className={styles.numeric}>
                  Embedding tokens
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{formatInstant(run.startedAt)}</td>
                  <td>
                    <RunStatus status={run.status} />
                  </td>
                  <td>{run.startedBy?.fullName ?? 'Removed user'}</td>
                  <td>{duration(run, now)}</td>
                  <td className={styles.numeric}>
                    {formatCount(run.files.ingested)} / {formatCount(run.files.failed.length)} failed
                  </td>
                  <td className={styles.numeric}>{formatCount(run.chunks.embedded)}</td>
                  <td className={styles.numeric}>{formatCount(run.embeddingTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={styles.cardList} aria-label="Previous index runs, newest first">
          {runs.map((run) => (
            <li key={run.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cellTitle}>{formatInstant(run.startedAt)}</span>
                <RunStatus status={run.status} />
              </div>
              <p className={styles.cellSub}>
                {run.startedBy?.fullName ?? 'Removed user'} · {duration(run, now)}
              </p>
              <p className={styles.cellSub}>
                {formatCount(run.files.ingested)} files ({formatCount(run.files.failed.length)} failed) ·{' '}
                {formatCount(run.chunks.embedded)} chunks embedded · {formatCount(run.embeddingTokens)} tokens
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
