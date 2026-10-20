import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { conflictFieldError, errorMessage, hasCode } from '@/api/errors';

describe('errorMessage', () => {
  it('uses the catalogue copy, never the backend message', () => {
    expect(errorMessage(new ApiError('COLLEGE_INACTIVE', 'raw server text', 403))).toBe(
      "Your college's account is inactive. Contact your administrator.",
    );
    expect(errorMessage(new ApiError('RATE_LIMITED', 'x', 429))).toBe('Too many requests, try again shortly.');
  });

  it('has copy for the tutor codes (F5a)', () => {
    expect(errorMessage(new ApiError('QUOTA_EXCEEDED', 'x', 429))).toBe(
      "You've used today's 10 questions. They reset at midnight India time.",
    );
    expect(errorMessage(new ApiError('AI_UNAVAILABLE', 'x', 503))).toBe(
      "The tutor couldn't answer just now. Your question wasn't counted.",
    );
    expect(errorMessage(new ApiError('INDEX_RUN_IN_PROGRESS', 'x', 409))).toBe('A re-index is already running.');
  });

  it('falls back by status, then to a generic sentence', () => {
    expect(errorMessage(new ApiError('SOMETHING_NEW', 'x', 503))).toBe(
      'Lexly is having trouble right now. Please try again in a moment.',
    );
    expect(errorMessage(new ApiError('SOMETHING_NEW', 'x', 409))).toBe('Something went wrong. Please try again.');
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});

describe('conflictFieldError', () => {
  it('puts uniqueness conflicts under their request field', () => {
    expect(conflictFieldError(new ApiError('COLLEGE_CODE_ALREADY_EXISTS', 'x', 409))).toEqual({
      code: 'Another college already uses this code.',
    });
    expect(conflictFieldError(new ApiError('SHORT_CODE_ALREADY_EXISTS', 'x', 409))).toHaveProperty('shortCode');
    expect(conflictFieldError(new ApiError('NOT_FOUND', 'x', 404))).toBeNull();
  });
});

describe('hasCode', () => {
  it('narrows on the code only', () => {
    expect(hasCode(new ApiError('NOT_FOUND', 'x', 404), 'NOT_FOUND')).toBe(true);
    expect(hasCode(new ApiError('FORBIDDEN', 'x', 403), 'NOT_FOUND')).toBe(false);
    expect(hasCode('NOT_FOUND', 'NOT_FOUND')).toBe(false);
  });
});
