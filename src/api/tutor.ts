/**
 * `/tutor/**` (contract §11a.2–11a.4, every role) and the SUPERADMIN tutor endpoints (§11a.5).
 * The backend answers from `lexly-ai-service`; the browser never calls that service. Every tutor
 * response is `no-store`, and question or answer text never goes into a URL.
 */
import { apiClient } from '@/api/client';
import { blankToNull, count, oneOf, toNumber } from '@/api/assessments';
import type { Role } from '@/auth/roles';

/** Mirrors `TutorAskRequest`'s `@Size`. */
export const QUESTION_MAX = 2000;

export interface TutorConversation {
  id: string;
  /** The first question on one line, cut to 120 characters by the server. */
  title: string;
  createdAt: string | null;
  lastMessageAt: string | null;
  /** `lastMessageAt` + 24 h; the conversation is a `404` from then on. */
  expiresAt: string | null;
}

export const CITATION_SOURCE_TYPES = ['SECTION', 'CASE_LAW', 'FILE'] as const;
export type CitationSourceType = (typeof CITATION_SOURCE_TYPES)[number];

export interface TutorCitation {
  /** The `n` of the `[n]` markers in the answer. */
  ref: number;
  sourceType: CitationSourceType;
  /** The section or case law id; `null` for `FILE`. */
  sourceId: string | null;
  label: string;
  /** For `FILE` only: `page 4`, `sheet 'Marks', rows 21-40` … */
  location: string | null;
  /** At most 300 characters. */
  snippet: string | null;
}

export type TutorMessageRole = 'USER' | 'ASSISTANT';

export interface TutorMessage {
  id: string;
  role: TutorMessageRole;
  /** Plain text; an answer carries `[n]` markers. */
  content: string;
  /** The sources didn't answer the question; `content` is then the fixed "not found" sentence. */
  notFound: boolean;
  /** In `ref` order; `[]` for questions and not-found answers. */
  citations: TutorCitation[];
  createdAt: string | null;
}

export interface TutorConversationDetail extends TutorConversation {
  /** Oldest first. */
  messages: TutorMessage[];
}

export interface TutorQuota {
  limit: number;
  used: number;
  remaining: number;
  /** The next midnight in Asia/Kolkata, as a UTC instant. */
  resetsAt: string | null;
}

export interface TutorAnswer {
  conversation: TutorConversation;
  question: TutorMessage;
  answer: TutorMessage;
  /** After this question. */
  quota: TutorQuota;
}

type ConversationDto = Partial<TutorConversation>;
type CitationDto = Partial<Omit<TutorCitation, 'sourceType'>> & { sourceType?: string };
type MessageDto = Partial<Omit<TutorMessage, 'role' | 'citations'>> & {
  role?: string;
  citations?: CitationDto[] | null;
};
type QuotaDto = Partial<TutorQuota>;

export function toTutorConversation(dto: ConversationDto | null | undefined): TutorConversation {
  return {
    id: dto?.id ?? '',
    title: dto?.title?.trim() || 'Untitled chat',
    createdAt: dto?.createdAt ?? null,
    lastMessageAt: dto?.lastMessageAt ?? null,
    expiresAt: dto?.expiresAt ?? null,
  };
}

export function toTutorCitation(dto: CitationDto): TutorCitation {
  const sourceType = oneOf(CITATION_SOURCE_TYPES, dto.sourceType);
  return {
    ref: count(dto.ref),
    sourceType,
    sourceId: sourceType === 'FILE' ? null : blankToNull(dto.sourceId),
    label: dto.label?.trim() || 'Untitled source',
    location: blankToNull(dto.location),
    snippet: blankToNull(dto.snippet),
  };
}

export function toTutorMessage(dto: MessageDto | null | undefined): TutorMessage {
  const role: TutorMessageRole = dto?.role === 'ASSISTANT' ? 'ASSISTANT' : 'USER';
  return {
    id: dto?.id ?? '',
    role,
    content: dto?.content ?? '',
    notFound: role === 'ASSISTANT' && dto?.notFound === true,
    citations: role === 'ASSISTANT' ? (dto?.citations ?? []).map(toTutorCitation) : [],
    createdAt: dto?.createdAt ?? null,
  };
}

export function toTutorQuota(dto: QuotaDto | null | undefined): TutorQuota {
  const limit = count(dto?.limit);
  const used = count(dto?.used);
  return {
    limit,
    used,
    remaining: toNumber(dto?.remaining) ?? Math.max(limit - used, 0),
    resetsAt: dto?.resetsAt ?? null,
  };
}

export function toTutorConversationDetail(
  dto: (ConversationDto & { messages?: MessageDto[] | null }) | null | undefined,
): TutorConversationDetail {
  return { ...toTutorConversation(dto), messages: (dto?.messages ?? []).map(toTutorMessage) };
}

export function toTutorAnswer(dto: {
  conversation?: ConversationDto | null;
  question?: MessageDto | null;
  answer?: MessageDto | null;
  quota?: QuotaDto | null;
}): TutorAnswer {
  return {
    conversation: toTutorConversation(dto.conversation),
    question: toTutorMessage({ role: 'USER', ...dto.question }),
    answer: toTutorMessage({ role: 'ASSISTANT', ...dto.answer }),
    quota: toTutorQuota(dto.quota),
  };
}

const conversationPath = (id: string) => `/tutor/conversations/${encodeURIComponent(id)}`;

/**
 * `POST /tutor/messages`. The backend waits up to ~60 s for the model, so this call has no
 * client-side timeout (plain `fetch` has none). `conversationId: null` starts a new chat.
 */
export async function askTutor(conversationId: string | null, question: string): Promise<TutorAnswer> {
  return toTutorAnswer(await apiClient.post('/tutor/messages', { conversationId, question }));
}

export async function getTutorQuota(signal?: AbortSignal): Promise<TutorQuota> {
  return toTutorQuota(await apiClient.get<QuotaDto>('/tutor/quota', { signal }));
}

/** Live conversations only, newest `lastMessageAt` first (kept as sent). */
export async function listTutorConversations(signal?: AbortSignal): Promise<TutorConversation[]> {
  const list = await apiClient.get<ConversationDto[] | null>('/tutor/conversations', { signal });
  return (list ?? []).map(toTutorConversation);
}

export async function getTutorConversation(id: string, signal?: AbortSignal): Promise<TutorConversationDetail> {
  return toTutorConversationDetail(await apiClient.get(conversationPath(id), { signal }));
}

export async function deleteTutorConversation(id: string): Promise<void> {
  await apiClient.delete<void>(conversationPath(id));
}

// ---------- SUPERADMIN: index runs (§11a.5) ----------

export const INDEX_RUN_STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED'] as const;
export type IndexRunStatus = (typeof INDEX_RUN_STATUSES)[number];

export interface TutorIndexRun {
  id: string;
  status: IndexRunStatus;
  startedAt: string | null;
  /** `null` while running. */
  finishedAt: string | null;
  /** `null` once that user was removed. */
  startedBy: { id: string; fullName: string | null } | null;
  /** Counts not known yet are `0` while running. */
  files: { ingested: number; failed: string[] };
  library: { sections: number; caseLaws: number };
  chunks: { embedded: number; reused: number; removed: number };
  embeddingTokens: number;
  /** A short safe message for `FAILED`. */
  error: string | null;
}

type IndexRunDto = {
  id?: string;
  status?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  startedBy?: { id?: string; fullName?: string | null } | null;
  files?: { ingested?: number; failed?: string[] | null } | null;
  library?: Partial<TutorIndexRun['library']> | null;
  chunks?: Partial<TutorIndexRun['chunks']> | null;
  embeddingTokens?: number;
  error?: string | null;
};

export function toTutorIndexRun(dto: IndexRunDto): TutorIndexRun {
  return {
    id: dto.id ?? '',
    status: oneOf(INDEX_RUN_STATUSES, dto.status),
    startedAt: dto.startedAt ?? null,
    finishedAt: dto.finishedAt ?? null,
    startedBy: dto.startedBy?.id ? { id: dto.startedBy.id, fullName: blankToNull(dto.startedBy.fullName) } : null,
    files: { ingested: count(dto.files?.ingested), failed: dto.files?.failed ?? [] },
    library: { sections: count(dto.library?.sections), caseLaws: count(dto.library?.caseLaws) },
    chunks: {
      embedded: count(dto.chunks?.embedded),
      reused: count(dto.chunks?.reused),
      removed: count(dto.chunks?.removed),
    },
    embeddingTokens: count(dto.embeddingTokens),
    error: blankToNull(dto.error),
  };
}

/** The last 10 runs, newest first; `[]` if none. */
export async function listIndexRuns(signal?: AbortSignal): Promise<TutorIndexRun[]> {
  const list = await apiClient.get<IndexRunDto[] | null>('/superadmin/tutor/index-runs', { signal });
  return (list ?? []).map(toTutorIndexRun);
}

/** `202` with the new run, or `409 INDEX_RUN_IN_PROGRESS`. */
export async function startIndexRun(): Promise<TutorIndexRun> {
  return toTutorIndexRun(await apiClient.post<IndexRunDto>('/superadmin/tutor/index-runs'));
}

// ---------- SUPERADMIN: AI spend (§11a.5) ----------

export interface AiUsageCounts {
  questions: number;
  indexRuns: number;
  inputTokens: number;
  outputTokens: number;
  embeddingTokens: number;
  /** USD, the sum of the stored per-event costs, 4 decimals. */
  cost: number;
}

export interface AiUsageDay extends AiUsageCounts {
  /** `yyyy-MM-dd`, an India date. */
  date: string;
}

export interface AiUsageDaily {
  from: string;
  to: string;
  currency: string;
  /** The current rates, per million tokens. */
  rates: { inputPerMillion: number; outputPerMillion: number; embeddingPerMillion: number };
  /** One per date in the range, zero-filled, oldest first. */
  days: AiUsageDay[];
  totals: AiUsageCounts;
}

export interface AiUsageFilters {
  from: string;
  to: string;
  collegeId?: string;
  role?: Role;
}

/** Java `BigDecimal`s arrive as JSON numbers, but a string is tolerated too. */
function decimal(value: unknown): number {
  const number = typeof value === 'string' ? Number(value) : value;
  return toNumber(number) ?? 0;
}

type CountsDto = Partial<Record<keyof AiUsageCounts, unknown>>;

function toCounts(dto: CountsDto | null | undefined): AiUsageCounts {
  return {
    questions: count(dto?.questions),
    indexRuns: count(dto?.indexRuns),
    inputTokens: count(dto?.inputTokens),
    outputTokens: count(dto?.outputTokens),
    embeddingTokens: count(dto?.embeddingTokens),
    cost: decimal(dto?.cost),
  };
}

type UsageDto = {
  from?: string;
  to?: string;
  currency?: string;
  rates?: Partial<Record<keyof AiUsageDaily['rates'], unknown>> | null;
  days?: (CountsDto & { date?: string })[] | null;
  totals?: CountsDto | null;
};

export function toAiUsageDaily(dto: UsageDto): AiUsageDaily {
  return {
    from: dto.from ?? '',
    to: dto.to ?? '',
    currency: dto.currency || 'USD',
    rates: {
      inputPerMillion: decimal(dto.rates?.inputPerMillion),
      outputPerMillion: decimal(dto.rates?.outputPerMillion),
      embeddingPerMillion: decimal(dto.rates?.embeddingPerMillion),
    },
    days: (dto.days ?? []).map((day) => ({ date: day.date ?? '', ...toCounts(day) })),
    totals: toCounts(dto.totals),
  };
}

export async function getAiUsageDaily(filters: AiUsageFilters, signal?: AbortSignal): Promise<AiUsageDaily> {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.collegeId) params.set('collegeId', filters.collegeId);
  if (filters.role) params.set('role', filters.role);
  return toAiUsageDaily(await apiClient.get<UsageDto>(`/superadmin/ai-usage/daily?${params}`, { signal }));
}
