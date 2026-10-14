import { describe, expect, it } from 'vitest';
import { toAuditEvent, type AuditEvent } from '@/api/audit';
import { actionLabel, auditActor, auditSummary, detailValue, humaniseCode, humaniseKey } from './auditFormat';

function event(overrides: Partial<Parameters<typeof toAuditEvent>[0]>): AuditEvent {
  return toAuditEvent({
    id: 'e1',
    createdAt: '2026-10-13T09:15:00Z',
    actor: { id: 'u1', fullName: 'Meera Iyer', role: 'SUPERADMIN' },
    college: { id: 'c1', code: 'NLSIU', name: 'National Law School' },
    action: 'COLLEGE_CREATED',
    entityType: 'COLLEGE',
    entityId: 'c1',
    details: {},
    ...overrides,
  });
}

describe('auditSummary (UI spec F1.10)', () => {
  it('summarises what P1 records', () => {
    expect(auditSummary(event({ action: 'LOGIN_FAILED', actor: null, details: { identifier: 'NLSIU:21BAL042', reason: 'BAD_CREDENTIALS' } }))).toBe(
      'NLSIU:21BAL042',
    );
    expect(auditSummary(event({ action: 'LOGIN_FAILED', details: { identifier: 'a@b.in', reason: 'COLLEGE_INACTIVE' } }))).toBe(
      'a@b.in · College inactive',
    );
    expect(auditSummary(event({ action: 'PASSWORD_RESET', details: { role: 'C_ADMIN' } }))).toBe('College admin account');
    expect(auditSummary(event({ action: 'PASSWORD_CHANGED' }))).toBe('By Meera Iyer');
    expect(auditSummary(event({ details: { name: 'National Law School' } }))).toBe('NLSIU · National Law School');
    expect(auditSummary(event({ action: 'COLLEGE_UPDATED', details: { name: 'NLS', active: false } }))).toBe('NLSIU · NLS · Inactive');
    expect(auditSummary(event({ action: 'USER_CREATED', details: { email: 'meera@nlsiu.ac.in', role: 'C_ADMIN' } }))).toBe(
      'meera@nlsiu.ac.in · College admin',
    );
    expect(
      auditSummary(event({ action: 'CONTENT_IMPORT', college: null, details: { kind: 'SECTIONS', total: 5, created: 2, rejected: 3, failed: 0 } })),
    ).toBe('Sections: 2 created, 3 rejected, 0 failed of 5');
  });

  it('summarises what P2 records for college users and subjects', () => {
    expect(auditSummary(event({ action: 'USER_CREATED', details: { loginId: '21BAL042', role: 'C_STUDENT' } }))).toBe(
      '21BAL042 · Student',
    );
    expect(auditSummary(event({ action: 'USER_REMOVED', details: { loginId: 'EMP7', role: 'C_PROFESSOR' } }))).toBe(
      'EMP7 · Professor',
    );
    expect(auditSummary(event({ action: 'PASSWORD_RESET', details: { role: 'C_PROFESSOR', loginId: 'EMP7' } }))).toBe(
      'Professor account · EMP7',
    );
    expect(
      auditSummary(
        event({
          action: 'USER_IMPORT',
          details: { kind: 'STUDENTS', total: 5, created: 2, converted: 1, rejected: 1, failed: 1 },
        }),
      ),
    ).toBe('Students: 2 created, 1 converted, 1 rejected, 1 failed of 5');
    expect(auditSummary(event({ action: 'SUBJECT_CREATED', details: { code: 'CON-101', name: 'Constitutional Law I' } }))).toBe(
      'CON-101 · Constitutional Law I',
    );
    expect(
      auditSummary(event({ action: 'SUBJECT_PROFESSORS_CHANGED', details: { code: 'CON-101', professorIds: ['a', 'b'] } })),
    ).toBe('CON-101 · 2 professors');
  });

  it('shows a dash for missing fields and unknown actions', () => {
    expect(auditSummary(event({ action: 'PASSWORD_RESET' }))).toBe('—');
    expect(auditSummary(event({ action: 'SOMETHING_NEW' }))).toBe('—');
    expect(actionLabel('SOMETHING_NEW')).toBeNull();
    expect(actionLabel('USER_IMPORT')).toBe('Users imported');
  });
});

describe('auditActor', () => {
  it('names the actor with the role label, or System', () => {
    expect(auditActor(event({}))).toBe('Meera Iyer · Super admin');
    expect(auditActor(event({ actor: null }))).toBe('System');
  });
});

describe('details as text', () => {
  it('humanises keys and codes, and never returns markup', () => {
    expect(humaniseKey('rejected')).toBe('Rejected');
    expect(humaniseKey('actorEmail')).toBe('Actor email');
    expect(humaniseCode('BARE_ACT')).toBe('Bare act');
    expect(detailValue('<b>x</b>')).toEqual({ text: '<b>x</b>', nested: false });
    expect(detailValue({ a: [1] })).toEqual({ text: '{\n  "a": [\n    1\n  ]\n}', nested: true });
    expect(detailValue(null)).toEqual({ text: '—', nested: false });
  });

  it('a non-object details value becomes {}', () => {
    expect(event({ details: null }).details).toEqual({});
    expect(event({ details: ['x'] as never }).details).toEqual({});
  });
});
