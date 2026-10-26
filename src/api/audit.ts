/**
 * `GET /audit` (contract §7): SUPERADMIN sees every college, C_ADMIN only their own (the server
 * scopes it). Rows are kept for 30 days. `details` is free-form JSON and is only ever rendered as
 * text.
 */
import { apiClient } from '@/api/client';
import type { Page } from '@/api/content';
import { toRole, type Role } from '@/auth/roles';

/** The contract's list. Only these are sent as a filter: an unknown value is a `400`. */
export const AUDIT_ACTIONS = [
  'LOGIN_FAILED',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'COLLEGE_CREATED',
  'COLLEGE_UPDATED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_REMOVED',
  'USER_IMPORT',
  'CONTENT_IMPORT',
  'SUBJECT_CREATED',
  'SUBJECT_UPDATED',
  'SUBJECT_DELETED',
  'SUBJECT_PROFESSORS_CHANGED',
  'ASSESSMENT_PUBLISHED',
  'ASSESSMENT_REMOVED',
  'AI_EVALUATION_REQUESTED',
  'GRADE_EDITED',
  'GRADE_PUBLISHED',
  'NOTE_UPLOADED',
  'NOTE_REPLACED',
  'NOTE_DELETED',
  'SOLO_PLAN_CHANGED',
  'SOLO_QUOTA_RESET',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  /** Null for system events, failed sign-ins and deleted users. */
  actor: { id: string; fullName: string | null; role: Role | null } | null;
  /** Null for platform-wide events such as `CONTENT_IMPORT`. */
  college: { id: string; code: string; name: string } | null;
  /** Kept as a string so a new backend action never breaks the page. */
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
}

interface AuditEventDto extends Omit<AuditEvent, 'actor' | 'details'> {
  actor: { id: string; fullName: string | null; role: string | null } | null;
  details: Record<string, unknown> | null;
}

export function toAuditEvent(dto: AuditEventDto): AuditEvent {
  return {
    ...dto,
    actor: dto.actor ? { id: dto.actor.id, fullName: dto.actor.fullName?.trim() || null, role: toRole(dto.actor.role) } : null,
    college: dto.college ?? null,
    entityType: dto.entityType ?? null,
    entityId: dto.entityId ?? null,
    details: dto.details && typeof dto.details === 'object' && !Array.isArray(dto.details) ? dto.details : {},
  };
}

export interface AuditQuery {
  collegeId?: string;
  action?: AuditAction;
  /** Instants; `to` is exclusive. */
  from?: string;
  to?: string;
  page: number;
  size: number;
}

export async function listAudit(query: AuditQuery): Promise<Page<AuditEvent>> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.collegeId) params.set('collegeId', query.collegeId);
  if (query.action) params.set('action', query.action);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const page = await apiClient.get<Page<AuditEventDto>>(`/audit?${params}`);
  return { ...page, content: (page.content ?? []).map(toAuditEvent) };
}
