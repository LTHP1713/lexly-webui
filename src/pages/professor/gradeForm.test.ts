import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import {
  FEEDBACK_REQUIRED,
  MARKS_REQUIRED,
  formFromGrade,
  gradeBanner,
  gradeFieldErrors,
  gradeMarksError,
  gradeSnapshot,
  requestFromGradeForm,
  validateApprove,
  validateDraft,
} from './gradeForm';

const range = 'Enter marks from 0 to 10, in whole or half marks.';

describe('grade marks (F4 MarksInput)', () => {
  it('allows 0 to max in half steps, and blank', () => {
    for (const value of ['', '0', '0.5', '7.5', '10']) expect(gradeMarksError(value, 10)).toBeNull();
  });

  it('rejects out-of-range, non-half and unreadable marks', () => {
    for (const value of ['-0.5', '10.5', '7.3', 'abc']) expect(gradeMarksError(value, 10)).toBe(range);
  });
});

describe('validateDraft / validateApprove (F4.2)', () => {
  it('lets a draft be saved half-done', () => {
    expect(validateDraft({ marks: '', feedback: '' }, 10)).toEqual({});
    expect(validateDraft({ marks: '11', feedback: '' }, 10)).toEqual({ finalMarks: range });
    expect(validateDraft({ marks: '', feedback: 'x'.repeat(10_001) }, 10).finalFeedback).toMatch(/at most 10,000/);
  });

  it('blocks approve without marks or with blank feedback', () => {
    expect(validateApprove({ marks: '', feedback: '   ' }, 10)).toEqual({
      finalMarks: MARKS_REQUIRED,
      finalFeedback: FEEDBACK_REQUIRED,
    });
    expect(validateApprove({ marks: '12', feedback: 'Good.' }, 10)).toEqual({ finalMarks: range });
    expect(validateApprove({ marks: '7.5', feedback: 'Good.' }, 10)).toEqual({});
  });
});

describe('request and snapshot', () => {
  it('sends blanks as null and keeps the feedback as typed', () => {
    expect(requestFromGradeForm({ marks: ' ', feedback: '  ' })).toEqual({ finalMarks: null, finalFeedback: null });
    expect(requestFromGradeForm({ marks: '7.5', feedback: 'Line 1\nLine 2' })).toEqual({
      finalMarks: 7.5,
      finalFeedback: 'Line 1\nLine 2',
    });
  });

  it('round-trips a saved grade without looking dirty', () => {
    const grade = { status: 'PENDING' as const, finalMarks: 8, finalFeedback: 'Fine.', gradedBy: null, publishedAt: null };
    const form = formFromGrade(grade);
    expect(form).toEqual({ marks: '8', feedback: 'Fine.' });
    expect(gradeSnapshot(form)).toBe(gradeSnapshot({ marks: '8.0', feedback: 'Fine.' }));
  });
});

describe('server errors', () => {
  it('puts INVALID_MARKS and the approve VALIDATION_ERROR paths on the fields', () => {
    expect(gradeFieldErrors(new ApiError('INVALID_MARKS', 'finalMarks: must be between 0 and 10.0 in steps of 0.5', 400), 10)).toEqual({
      finalMarks: range,
    });
    expect(
      gradeFieldErrors(
        new ApiError('VALIDATION_ERROR', 'finalMarks: must not be null, finalFeedback: must not be blank', 400),
        10,
      ),
    ).toEqual({ finalMarks: MARKS_REQUIRED, finalFeedback: FEEDBACK_REQUIRED });
  });

  it('leaves other errors to the banner', () => {
    const published = new ApiError('GRADE_PUBLISHED', 'This grade has been published', 409);
    expect(gradeFieldErrors(published, 10)).toBeNull();
    expect(gradeBanner(published)).toMatch(/already been published/);
    expect(gradeBanner(new ApiError('ASSESSMENT_NOT_EDITABLE', 'x', 409))).toMatch(/was removed/);
  });
});
