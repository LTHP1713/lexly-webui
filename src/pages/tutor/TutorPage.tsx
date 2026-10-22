import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { hasCode } from '@/api/errors';
import {
  askTutor,
  deleteTutorConversation,
  getTutorConversation,
  getTutorQuota,
  listTutorConversations,
  QUESTION_MAX,
  type TutorConversation,
  type TutorConversationDetail,
  type TutorQuota,
} from '@/api/tutor';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LexlySpark } from '@/components/brand/Logo';
import { ArrowLeftIcon, TrashIcon } from '@/components/icons/Icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useToast } from '@/components/Toast';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNow } from '@/lib/deadline';
import { formatCount, formatInstant } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { MessageList } from './Messages';
import { formatExpiresIn, formatResetsAt, MAYBE_ANSWERED, NOT_COUNTED, questionError } from './tutorFormat';
import styles from '@/components/ui.module.css';
import tutorStyles from './Tutor.module.css';

/** The question being answered (or that failed); not stored anywhere until the server answers. */
export interface PendingQuestion {
  /** `null` for a new chat. */
  conversationId: string | null;
  question: string;
  status: 'sending' | 'failed';
  /**
   * Only `AI_UNAVAILABLE` guarantees nothing was stored or counted. After a lost connection or
   * another server error the answer may have been saved, so the copy says so (contract §11a.2).
   */
  maybeAnswered?: boolean;
}

const EXAMPLES = [
  'Is a contract with a minor void?',
  'What is the difference between culpable homicide and murder?',
  'When can a court grant anticipatory bail?',
];

const EXPIRED_NOTICE =
  'This conversation has expired or was deleted. Your question is still below; send it to start a new chat.';
const ANSWERING = 'Answering… this can take up to a minute';

/**
 * `/tutor` (a new chat) and `/tutor/:conversationId` (UI spec F5a.3), for every role. The URL only
 * ever holds the conversation id. One question is in flight at a time; it lives in this page's
 * state (not the thread's), so it survives switching chats and a new chat getting its id.
 */
export function TutorPage() {
  const { conversationId = null } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const wide = useMediaQuery('(min-width: 1024px)');

  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [showList, setShowList] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Where the user is now, read when an answer arrives (possibly after they moved on).
  const currentId = useRef(conversationId);
  const mounted = useRef(true);
  useEffect(() => {
    currentId.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const quota = useCachedQuery(queryKeys.tutor.quota, (signal) => getTutorQuota(signal), {
    // Once today's questions are used, reload the quota just after it resets, so an open tab unblocks.
    refetchInterval: (data) => {
      if (!data || data.remaining > 0 || !data.resetsAt) return false;
      const left = new Date(data.resetsAt).getTime() - Date.now();
      return Number.isNaN(left) ? false : Math.max(left + 1000, 5000);
    },
  });
  const quotaData = quota.status === 'success' ? quota.data : null;
  // The server's quota decides; the flag only covers a quota that never loaded.
  const exhausted = quotaData !== null ? quotaData.remaining <= 0 : quotaBlocked;
  const sending = pending?.status === 'sending';

  /** Puts a question back in the composer without losing anything typed since. */
  function restoreDraft(question: string) {
    setDraft((current) => (current.trim() ? `${question}\n\n${current}` : question));
  }

  async function send(question: string, target: string | null) {
    setPending({ conversationId: target, question, status: 'sending' });
    setNotice(null);
    setAnnouncement(ANSWERING);
    try {
      const result = await askTutor(target, question);
      const id = result.conversation.id;
      const detailKey = queryKeys.tutor.conversation(id);
      // A load started before the answer was stored would overwrite the appended messages.
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<TutorConversationDetail>(detailKey);
      if (target === null || previous) {
        queryClient.setQueryData<TutorConversationDetail>(detailKey, {
          ...result.conversation,
          messages: [...(previous?.messages ?? []), result.question, result.answer],
        });
      } else {
        // The earlier messages were never loaded, so appending would show a truncated chat.
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
      queryClient.setQueryData<TutorQuota>(queryKeys.tutor.quota, result.quota);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.conversations });
      setPending(null);
      setAnnouncement('Answer received.');
      if (target === null && mounted.current && currentId.current === null) {
        navigate(`/tutor/${encodeURIComponent(id)}`, { replace: true });
      }
    } catch (err) {
      if (hasCode(err, 'QUOTA_EXCEEDED')) {
        setPending(null);
        restoreDraft(question);
        queryClient.setQueryData<TutorQuota>(queryKeys.tutor.quota, (previous) =>
          previous ? { ...previous, used: Math.max(previous.used, previous.limit), remaining: 0 } : previous,
        );
        setQuotaBlocked(true);
        setAnnouncement('');
        void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.quota });
      } else if (hasCode(err, 'NOT_FOUND') && target !== null) {
        setPending(null);
        restoreDraft(question);
        setNotice(EXPIRED_NOTICE);
        setAnnouncement('');
        queryClient.removeQueries({ queryKey: queryKeys.tutor.conversation(target) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.conversations });
        if (mounted.current && currentId.current === target) navigate('/tutor');
      } else if (hasCode(err, 'VALIDATION_ERROR')) {
        setPending(null);
        restoreDraft(question);
        setDraftError(questionError(question) ?? 'Type a question first.');
        setAnnouncement('');
      } else {
        const maybeAnswered = !hasCode(err, 'AI_UNAVAILABLE');
        setPending({ conversationId: target, question, status: 'failed', maybeAnswered });
        setAnnouncement(maybeAnswered ? MAYBE_ANSWERED : NOT_COUNTED);
        if (maybeAnswered) {
          // If the server did answer, the chat and the spent question show up here.
          void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.conversations });
          void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.quota });
          if (target !== null) void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.conversation(target) });
        }
      }
    }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (sending || exhausted) return;
    const error = questionError(draft);
    setDraftError(error);
    if (error) {
      composerRef.current?.focus();
      return;
    }
    const question = draft.trim();
    setDraft('');
    void send(question, conversationId);
  }

  function startNewChat() {
    setNotice(null);
    setShowList(false);
    navigate('/tutor');
  }

  const pendingHere = pending && pending.conversationId === conversationId ? pending : null;
  const listPane = (
    <ConversationList
      currentId={conversationId}
      busy={sending}
      onNewChat={startNewChat}
      onOpen={() => {
        setShowList(false);
        setNotice(null);
      }}
      onDeleted={(id) => {
        toast.show('Chat deleted.');
        if (id === conversationId) navigate('/tutor');
      }}
    />
  );

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={`${styles.eyebrow} ${tutorStyles.aiEyebrow}`}>
            <LexlySpark size="0.95em" />
            Lexly tutor
          </p>
          <h1 className={styles.title}>Ask the tutor</h1>
        </div>
        {user?.role === 'SUPERADMIN' && (
          <Link to="/admin/tutor" className={styles.secondaryButton}>
            Tutor admin
          </Link>
        )}
      </div>

      <div className={tutorStyles.layout}>
        {wide && listPane}
        {!wide && showList ? (
          listPane
        ) : (
          <section className={tutorStyles.threadPane} aria-labelledby="tutor-thread-title">
            {!wide && (
              <button type="button" className={tutorStyles.backButton} onClick={() => setShowList(true)}>
                <ArrowLeftIcon size={18} />
                All chats
              </button>
            )}
            {conversationId ? (
              <ConversationThread
                conversationId={conversationId}
                pending={pendingHere}
                onRetry={(p) => void send(p.question, p.conversationId)}
                onEdit={(p) => {
                  setPending(null);
                  restoreDraft(p.question);
                  composerRef.current?.focus();
                }}
                onNewChat={startNewChat}
              />
            ) : (
              <NewChatThread
                pending={pendingHere}
                onRetry={(p) => void send(p.question, p.conversationId)}
                onEdit={(p) => {
                  setPending(null);
                  restoreDraft(p.question);
                  composerRef.current?.focus();
                }}
                onExample={(text) => {
                  setDraft(text);
                  setDraftError(null);
                  composerRef.current?.focus();
                }}
              />
            )}

            <p role="status" aria-live="polite" className={styles.visuallyHidden}>
              {announcement}
            </p>
            {notice && (
              <p role="alert" className={styles.notice}>
                {notice}
              </p>
            )}
            {exhausted && (
              <p role="status" className={tutorStyles.quotaBanner}>
                You&rsquo;ve used today&rsquo;s {quotaData?.limit ?? 10} questions. They reset at midnight India time (
                {formatResetsAt(quotaData?.resetsAt ?? null)}).
              </p>
            )}
            <Composer
              textareaRef={composerRef}
              value={draft}
              error={draftError}
              disabled={exhausted}
              sending={sending}
              onChange={(value) => {
                setDraft(value);
                if (draftError) setDraftError(null);
              }}
              onSubmit={submit}
            />
            <QuotaLine quota={quota.status === 'loading' ? 'loading' : quotaData} />
            <p className={tutorStyles.disclaimer}>
              Answers come only from Lexly&rsquo;s library and study material and may be incomplete. Check the cited
              sources.
            </p>
          </section>
        )}
      </div>
      {toast.element}
    </>
  );
}

// ---------- Conversation list ----------

function ConversationList({
  currentId,
  busy,
  onNewChat,
  onOpen,
  onDeleted,
}: {
  currentId: string | null;
  busy: boolean;
  onNewChat: () => void;
  onOpen: () => void;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const now = useNow();
  const list = useCachedQuery(queryKeys.tutor.conversations, (signal) => listTutorConversations(signal));
  const [deleting, setDeleting] = useState<TutorConversation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteTutorConversation(deleting.id);
    } catch (err) {
      // A 404 means it's already gone, which is what the user wanted.
      if (!hasCode(err, 'NOT_FOUND')) {
        setDeleteBusy(false);
        setDeleteError('The chat couldn’t be deleted. Please try again.');
        return;
      }
    }
    const id = deleting.id;
    queryClient.removeQueries({ queryKey: queryKeys.tutor.conversation(id) });
    queryClient.setQueryData<TutorConversation[]>(queryKeys.tutor.conversations, (previous) =>
      previous?.filter((c) => c.id !== id),
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.tutor.conversations });
    setDeleteBusy(false);
    setDeleting(null);
    onDeleted(id);
  }

  return (
    <aside className={tutorStyles.listPane} aria-labelledby="tutor-chats-title">
      <div className={tutorStyles.listHead}>
        <h2 id="tutor-chats-title" className={tutorStyles.paneTitle}>
          Your chats
        </h2>
        <button type="button" className={styles.primaryButton} onClick={onNewChat} disabled={busy}>
          New chat
        </button>
      </div>
      {list.status === 'loading' && !list.staleData && <LoadingState label="Loading your chats" lines={3} />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={list.retry} />}
      {(list.status === 'success' || (list.status === 'loading' && list.staleData)) &&
        (() => {
          const items = list.status === 'success' ? list.data : (list.staleData ?? []);
          if (items.length === 0) return <p className={styles.hint}>No chats in the last 24 hours.</p>;
          return (
            <ul className={tutorStyles.chatList} aria-busy={list.status === 'loading'}>
              {items.map((chat) => (
                <li key={chat.id} className={tutorStyles.chatItem}>
                  <Link
                    to={`/tutor/${encodeURIComponent(chat.id)}`}
                    className={tutorStyles.chatLink}
                    aria-current={chat.id === currentId ? 'page' : undefined}
                    onClick={onOpen}
                  >
                    <span className={tutorStyles.chatTitle} title={chat.title}>
                      {chat.title}
                    </span>
                    <span className={tutorStyles.chatMeta} title={formatInstant(chat.expiresAt)}>
                      {formatExpiresIn(chat.expiresAt, now)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className={tutorStyles.iconButton}
                    aria-label={`Delete chat: ${chat.title}`}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(chat);
                    }}
                  >
                    <TrashIcon size={18} />
                  </button>
                </li>
              ))}
            </ul>
          );
        })()}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this chat?"
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete chat'}
        destructive
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      >
        <p>This chat will be deleted now. Chats are deleted automatically 24 h after the last message anyway.</p>
        {deleteError && (
          <p role="alert" className={styles.formError}>
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </aside>
  );
}

// ---------- Threads ----------

interface ThreadActions {
  pending: PendingQuestion | null;
  onRetry: (pending: PendingQuestion) => void;
  onEdit: (pending: PendingQuestion) => void;
}

function NewChatThread({ pending, onRetry, onEdit, onExample }: ThreadActions & { onExample: (text: string) => void }) {
  return (
    <>
      <h2 id="tutor-thread-title" className={styles.visuallyHidden}>
        New chat
      </h2>
      {pending ? (
        <MessageList messages={[]} pending={pending} onRetry={onRetry} onEdit={onEdit} />
      ) : (
        <div className={tutorStyles.intro}>
          <LexlySpark size={28} />
          <p>
            Ask about any act, section or case law in Lexly. Answers cite their sources, so you can read the law
            itself.
          </p>
          <h3 className={tutorStyles.introTitle}>Try asking</h3>
          <ul className={tutorStyles.examples}>
            {EXAMPLES.map((text) => (
              <li key={text}>
                <button type="button" className={tutorStyles.exampleButton} onClick={() => onExample(text)}>
                  {text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ConversationThread({
  conversationId,
  pending,
  onRetry,
  onEdit,
  onNewChat,
}: ThreadActions & { conversationId: string; onNewChat: () => void }) {
  const query = useCachedQuery(queryKeys.tutor.conversation(conversationId), (signal) =>
    getTutorConversation(conversationId, signal),
  );

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) {
    return (
      <EmptyState
        actions={
          <button type="button" className={styles.primaryButton} onClick={onNewChat}>
            New chat
          </button>
        }
      >
        <span id="tutor-thread-title" role="heading" aria-level={2}>
          This conversation has expired or was deleted.
        </span>
      </EmptyState>
    );
  }
  if (query.status === 'error') {
    return (
      <>
        <h2 id="tutor-thread-title" className={styles.visuallyHidden}>
          Chat
        </h2>
        <ErrorState error={query.error} onRetry={query.retry} />
      </>
    );
  }
  // The previous chat's messages are never shown under this one's URL.
  if (query.status !== 'success') {
    return (
      <>
        <h2 id="tutor-thread-title" className={styles.visuallyHidden}>
          Chat
        </h2>
        <LoadingState label="Loading the chat" />
        {pending && <MessageList messages={[]} pending={pending} onRetry={onRetry} onEdit={onEdit} />}
      </>
    );
  }
  return (
    <>
      <h2 id="tutor-thread-title" className={tutorStyles.threadTitle}>
        {query.data.title}
      </h2>
      <MessageList messages={query.data.messages} pending={pending} onRetry={onRetry} onEdit={onEdit} />
    </>
  );
}

// ---------- Composer and quota ----------

function Composer({
  textareaRef,
  value,
  error,
  disabled,
  sending,
  onChange,
  onSubmit,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  error: string | null;
  disabled: boolean;
  sending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const over = value.length > QUESTION_MAX;
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  }
  return (
    <form
      className={tutorStyles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <label htmlFor="tutor-question" className={styles.label}>
        Your question
      </label>
      <textarea
        ref={textareaRef}
        id="tutor-question"
        className={`${styles.textarea} ${tutorStyles.composerInput}`}
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={`tutor-question-help tutor-question-count${error ? ' tutor-question-error' : ''}`}
      />
      {error && (
        <p id="tutor-question-error" className={styles.fieldError}>
          {error}
        </p>
      )}
      <div className={tutorStyles.composerBar}>
        <span id="tutor-question-help" className={styles.hint}>
          Enter to send · Shift+Enter for a new line
        </span>
        <span id="tutor-question-count" className={`${styles.counter} ${over ? tutorStyles.counterOver : ''}`}>
          {formatCount(value.length)} / {formatCount(QUESTION_MAX)}
        </span>
        <button type="submit" className={styles.primaryButton} disabled={disabled || sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}

function QuotaLine({ quota }: { quota: TutorQuota | 'loading' | null }) {
  return (
    <p className={tutorStyles.quotaLine} aria-live="polite">
      {quota === 'loading'
        ? 'Checking today’s questions…'
        : quota &&
          `${formatCount(quota.remaining)} of ${formatCount(quota.limit)} questions left today · resets at ${formatResetsAt(quota.resetsAt)}`}
    </p>
  );
}
