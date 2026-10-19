import { useEffect, useId, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { errorMessage, hasCode } from '@/api/errors';
import localStyles from './Assessment.module.css';
import styles from './ui.module.css';

type ViewState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; filename: string }
  | { status: 'error'; message: string };

/**
 * Loads an answer PDF as a blob object URL. The file needs the bearer header, so it is fetched
 * with `apiClient.download` (never cached); the URL is revoked when the caller unmounts. Key the
 * caller by `path`, so another file starts from the loading state. `onLoaded` runs after each
 * successful load.
 */
function usePdfBlob(path: string, fallbackName: string, onLoaded?: () => void) {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ status: 'loading' });
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    apiClient
      .download(path, { signal: controller.signal })
      .then(({ blob, filename }) => {
        url = URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }));
        setView({ status: 'ready', url, filename: filename ?? fallbackName });
        onLoadedRef.current?.();
      })
      .catch((err: unknown) => {
        if (hasCode(err, 'ABORTED')) return;
        setView({
          status: 'error',
          message: hasCode(err, 'NOT_FOUND') ? 'This file is no longer available.' : errorMessage(err),
        });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, fallbackName, attempt]);

  return {
    view,
    retry: () => {
      setView({ status: 'loading' });
      setAttempt((n) => n + 1);
    },
  };
}

/** The frame, its loading and error states and the download fallback. */
function PdfBody({ view, retry, title }: { view: ViewState; retry: () => void; title: string }) {
  return (
    <>
      {view.status === 'loading' && (
        <p role="status" className={localStyles.pdfStatus}>
          Opening the PDF…
        </p>
      )}
      {view.status === 'error' && (
        <div role="alert" className={localStyles.pdfStatus}>
          <p className={styles.formError}>{view.message}</p>
          <button type="button" className={styles.secondaryButton} onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {view.status === 'ready' && (
        <>
          <iframe className={localStyles.pdfFrame} src={view.url} title={`PDF: ${title}`} />
          <p className={styles.hint}>
            If the PDF doesn&rsquo;t show,{' '}
            <a href={view.url} download={view.filename}>
              download it
            </a>
            .
          </p>
        </>
      )}
    </>
  );
}

/**
 * An answer PDF in a dialog (UI spec F3 `PdfViewer`), shown in the browser's own PDF viewer with
 * a download link for browsers (mostly phones) that don't render PDFs in a frame. Render it only
 * while open.
 */
export function PdfViewer({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { view, retry } = usePdfBlob(path, title);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${localStyles.pdfDialog}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={localStyles.pdfHead}>
        <h2 id={titleId} className={localStyles.pdfTitle}>
          {title}
        </h2>
        <button ref={closeRef} type="button" className={styles.secondaryButton} onClick={onClose}>
          Close
        </button>
      </div>
      <PdfBody view={view} retry={retry} title={title} />
    </dialog>
  );
}

/** The same PDF inline on a page (UI spec F4.1), e.g. next to the grade panel. */
export function PdfPanel({ path, title, onLoaded }: { path: string; title: string; onLoaded?: () => void }) {
  const { view, retry } = usePdfBlob(path, title, onLoaded);
  return (
    <div className={localStyles.pdfPanel}>
      <PdfBody view={view} retry={retry} title={title} />
    </div>
  );
}
