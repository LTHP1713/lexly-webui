import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TutorCitation, TutorMessage } from '@/api/tutor';
import { AlertIcon, LightbulbIcon } from '@/components/icons/Icons';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import type { PendingQuestion } from './TutorPage';
import { parseMarkers, splitParagraphs } from './tutorFormat';
import styles from '@/components/ui.module.css';
import tutorStyles from './Tutor.module.css';

const HIGHLIGHT_MS = 2000;

/**
 * A conversation's messages, oldest first, then the pending question if there is one. Every
 * piece of text is rendered as text nodes; answers never go through HTML (plan §9).
 */
export function MessageList({
  messages,
  pending,
  onRetry,
  onEdit,
}: {
  messages: TutorMessage[];
  pending: PendingQuestion | null;
  onRetry: (pending: PendingQuestion) => void;
  onEdit: (pending: PendingQuestion) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, pending?.status]);

  return (
    <>
      <ol className={tutorStyles.messages} aria-label="Conversation">
        {messages.map((message) => (
          <li key={message.id} className={message.role === 'USER' ? tutorStyles.userItem : tutorStyles.answerItem}>
            {message.role === 'USER' ? <UserMessage text={message.content} /> : <AnswerMessage message={message} />}
          </li>
        ))}
        {pending && (
          <li className={tutorStyles.userItem}>
            <UserMessage text={pending.question} />
            {pending.status === 'sending' ? (
              <p className={tutorStyles.answering}>
                <span className={tutorStyles.spinner} aria-hidden="true" />
                Answering… this can take up to a minute
              </p>
            ) : (
              <div role="alert" className={tutorStyles.failed}>
                <p>
                  <AlertIcon size={18} />
                  The tutor couldn&rsquo;t answer just now. Your question wasn&rsquo;t counted.
                </p>
                <div className={tutorStyles.failedActions}>
                  <button type="button" className={styles.primaryButton} onClick={() => onRetry(pending)}>
                    Try again
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => onEdit(pending)}>
                    Edit question
                  </button>
                </div>
              </div>
            )}
          </li>
        )}
      </ol>
      <div ref={endRef} />
    </>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className={tutorStyles.userBubble}>
      <span className={styles.visuallyHidden}>You: </span>
      {text}
    </div>
  );
}

function AnswerMessage({ message }: { message: TutorMessage }) {
  const wide = useMediaQuery(TABLE_QUERY);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const refs = useMemo(() => new Set(message.citations.map((c) => c.ref)), [message.citations]);
  const paragraphs = useMemo(() => splitParagraphs(message.content), [message.content]);
  const sourceId = (ref: number) => `source-${message.id}-${ref}`;

  if (message.notFound) {
    return (
      <div className={tutorStyles.notFound}>
        <span className={styles.visuallyHidden}>Tutor: </span>
        <p className={tutorStyles.notFoundText}>
          <LightbulbIcon size={18} />
          {message.content}
        </p>
        <p>Try naming the act or section.</p>
        <p className={tutorStyles.muted}>This still used one of today&rsquo;s questions.</p>
      </div>
    );
  }

  function showSource(ref: number) {
    const item = document.getElementById(sourceId(ref));
    if (!item) return;
    const details = item.querySelector('details');
    if (details) details.open = true;
    item.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    item.focus({ preventScroll: true });
    setHighlighted(ref);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
  }

  return (
    <div className={tutorStyles.answer}>
      <span className={styles.visuallyHidden}>Tutor: </span>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className={tutorStyles.answerParagraph}>
          {parseMarkers(paragraph, refs).map((segment, j) => {
            if (segment.kind === 'text') return segment.text;
            const citation = message.citations.find((c) => c.ref === segment.ref);
            return (
              <sup key={j}>
                <button
                  type="button"
                  className={tutorStyles.marker}
                  aria-label={`Source ${segment.ref}: ${citation?.label ?? ''}`}
                  onClick={() => showSource(segment.ref)}
                >
                  {segment.ref}
                </button>
              </sup>
            );
          })}
        </p>
      ))}
      {message.citations.length > 0 && (
        <section className={tutorStyles.sources} aria-label="Sources">
          <h3 className={tutorStyles.sourcesTitle}>Sources</h3>
          <ol className={tutorStyles.sourceList}>
            {message.citations.map((citation) => (
              <li
                key={citation.ref}
                id={sourceId(citation.ref)}
                tabIndex={-1}
                className={`${tutorStyles.source} ${highlighted === citation.ref ? tutorStyles.sourceHighlighted : ''}`}
              >
                <span className={tutorStyles.sourceRef}>[{citation.ref}]</span>
                <div className={tutorStyles.sourceBody}>
                  <SourceLabel citation={citation} />
                  {citation.snippet && (
                    <details className={tutorStyles.snippet} open={wide}>
                      <summary>Cited passage</summary>
                      <blockquote>{citation.snippet}</blockquote>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/** Library sources link to the reader; study-material files have no page in Lexly. */
function SourceLabel({ citation }: { citation: TutorCitation }) {
  if (citation.sourceType !== 'FILE' && citation.sourceId) {
    const base = citation.sourceType === 'SECTION' ? '/sections' : '/caselaws';
    return (
      <Link to={`${base}/${encodeURIComponent(citation.sourceId)}`} className={tutorStyles.sourceLink}>
        {citation.label}
      </Link>
    );
  }
  return (
    <span className={tutorStyles.sourceFile}>
      {citation.location ? `${citation.label} · ${citation.location}` : citation.label}{' '}
      <span className={tutorStyles.fileTag}>Study material</span>
    </span>
  );
}
