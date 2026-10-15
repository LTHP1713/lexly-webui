/**
 * Labels and one-line summaries for audit entries (UI spec F1.10). Everything is built as plain
 * text from `details`, which is free-form JSON: a missing field shows "—", and an action this
 * build doesn't know is shown as its raw code, so a new backend action never breaks the page.
 */
import type { AuditAction, AuditEvent } from '@/api/audit';
import { ROLE_LABELS, toRole } from '@/auth/roles';
import { formatInstant } from '@/lib/format';

export const ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN_FAILED: 'Failed sign-in',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_CHANGED: 'Password changed',
  COLLEGE_CREATED: 'College added',
  COLLEGE_UPDATED: 'College updated',
  USER_CREATED: 'User added',
  USER_UPDATED: 'User updated',
  USER_REMOVED: 'User removed',
  USER_IMPORT: 'Users imported',
  CONTENT_IMPORT: 'Content imported',
  SUBJECT_CREATED: 'Subject added',
  SUBJECT_UPDATED: 'Subject updated',
  SUBJECT_DELETED: 'Subject deleted',
  SUBJECT_PROFESSORS_CHANGED: 'Subject professors changed',
  ASSESSMENT_PUBLISHED: 'Assessment published',
  ASSESSMENT_REMOVED: 'Assessment removed',
  AI_EVALUATION_REQUESTED: 'AI evaluation requested',
  GRADE_EDITED: 'Grade edited',
  GRADE_PUBLISHED: 'Grade published',
  SOLO_PLAN_CHANGED: 'Solo plan changed',
  SOLO_QUOTA_RESET: 'Solo quota reset',
};

/** The label for a known action, or null (the caller shows the raw code in monospace). */
export function actionLabel(action: string): string | null {
  return (ACTION_LABELS as Record<string, string>)[action] ?? null;
}

/** `BARE_ACT` → "Bare act". */
export function humaniseCode(code: string): string {
  const words = code.toLowerCase().split('_').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `rejected` → "Rejected", `actorEmail` → "Actor email". */
export function humaniseKey(key: string): string {
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const DASH = '—';

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function roleLabel(value: unknown): string | null {
  const role = toRole(value);
  return role ? ROLE_LABELS[role] : text(value);
}

function counts(details: Record<string, unknown>, keys: string[]): string {
  const parts = keys.map((key) => `${text(details[key]) ?? DASH} ${key}`);
  return `${parts.join(', ')} of ${text(details.total) ?? DASH}`;
}

/** The "Details" column. Never HTML. */
export function auditSummary(event: AuditEvent): string {
  const d = event.details;
  switch (event.action) {
    case 'LOGIN_FAILED': {
      const identifier = text(d.identifier) ?? DASH;
      return d.reason === 'COLLEGE_INACTIVE' ? `${identifier} · College inactive` : identifier;
    }
    case 'PASSWORD_RESET': {
      const role = roleLabel(d.role);
      const shown = [role ? `${role} account` : null, text(d.loginId)].filter((p): p is string => p !== null);
      return shown.length > 0 ? shown.join(' · ') : DASH;
    }
    case 'PASSWORD_CHANGED':
      return event.actor?.fullName ? `By ${event.actor.fullName}` : DASH;
    case 'COLLEGE_CREATED':
    case 'COLLEGE_UPDATED': {
      const parts = [event.college?.code ?? null, text(d.name)];
      if (event.action === 'COLLEGE_UPDATED' && typeof d.active === 'boolean') parts.push(d.active ? 'Active' : 'Inactive');
      const shown = parts.filter((p): p is string => p !== null);
      return shown.length > 0 ? shown.join(' · ') : DASH;
    }
    case 'USER_CREATED':
    case 'USER_UPDATED':
    case 'USER_REMOVED': {
      // C_ADMIN accounts are recorded by email; students and professors by login ID (since P2).
      const shown = [text(d.email) ?? text(d.loginId), roleLabel(d.role)].filter((p): p is string => p !== null);
      return shown.length > 0 ? shown.join(' · ') : DASH;
    }
    case 'USER_IMPORT': {
      const kind = text(d.kind);
      const summary = counts(d, ['created', 'converted', 'rejected', 'failed']);
      return kind ? `${humaniseCode(kind)}: ${summary}` : summary;
    }
    case 'CONTENT_IMPORT': {
      const kind = text(d.kind);
      const summary = counts(d, ['created', 'rejected', 'failed']);
      return kind ? `${humaniseCode(kind)}: ${summary}` : summary;
    }
    case 'SUBJECT_CREATED':
    case 'SUBJECT_UPDATED':
    case 'SUBJECT_DELETED':
    case 'SUBJECT_PROFESSORS_CHANGED': {
      const shown = [text(d.code) ?? text(d.subjectCode), text(d.name)];
      if (event.action === 'SUBJECT_PROFESSORS_CHANGED' && Array.isArray(d.professorIds)) {
        const n = d.professorIds.length;
        shown.push(`${n} ${n === 1 ? 'professor' : 'professors'}`);
      }
      const parts = shown.filter((p): p is string => p !== null);
      return parts.length > 0 ? parts.join(' · ') : DASH;
    }
    case 'ASSESSMENT_PUBLISHED':
    case 'ASSESSMENT_REMOVED': {
      // "CON-101 · Moot problem · 10 questions, due 2 Nov 2026, 5:00 pm" (UI spec F3 audit summaries).
      const head = [text(d.subjectCode), text(d.title)].filter((p): p is string => p !== null).join(' · ');
      if (event.action === 'ASSESSMENT_REMOVED') return head || DASH;
      const n = typeof d.questionCount === 'number' ? d.questionCount : null;
      const due = text(d.dueAt);
      const tail = [n === null ? null : `${n} ${n === 1 ? 'question' : 'questions'}`, due ? `due ${formatInstant(due)}` : null]
        .filter(Boolean)
        .join(', ');
      return [head, tail].filter(Boolean).join(' · ') || DASH;
    }
    default:
      return DASH;
  }
}

/** Who did it: the actor's name and role, or "System" for entries without one. */
export function auditActor(event: AuditEvent): string {
  if (!event.actor) return 'System';
  const role = event.actor.role ? ROLE_LABELS[event.actor.role] : null;
  return [event.actor.fullName ?? 'Unknown user', role].filter(Boolean).join(' · ');
}

/** One `details` value as text: scalars as they are, anything nested as indented JSON. */
export function detailValue(value: unknown): { text: string; nested: boolean } {
  if (value === null || value === undefined) return { text: DASH, nested: false };
  if (typeof value === 'string') return { text: value || DASH, nested: false };
  if (typeof value === 'number' || typeof value === 'boolean') return { text: String(value), nested: false };
  return { text: JSON.stringify(value, null, 2), nested: true };
}
