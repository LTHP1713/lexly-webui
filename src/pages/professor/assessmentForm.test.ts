/** F3.2–F3.3 draft editor model: draft checks, the publish checklist and the request body (F3.10). */
import { describe, expect, it } from 'vitest';
import { toDateTimeLocal } from '@/lib/dateTimeLocal';
import {
  emptyForm,
  emptyQuestion,
  marksError,
  publishChecklist,
  publishErrors,
  requestFromForm,
  totalMarks,
  validateDraft,
  wordLimitError,
  type AssessmentForm,
} from './assessmentForm';

const NOW = new Date('2026-10-15T10:00:00Z').getTime();
const FUTURE = toDateTimeLocal('2026-11-02T12:00:00Z');
const PAST = toDateTimeLocal('2026-10-01T12:00:00Z');

function complete(overrides: Partial<AssessmentForm> = {}): AssessmentForm {
  return {
    subjectId: 's1',
    title: 'Moot problem',
    instructions: '',
    dueAt: FUTURE,
    questions: [{ ...emptyQuestion(), text: 'Discuss Article 21.', maxMarks: '10', wordLimit: '500' }],
    ...overrides,
  };
}

describe('marks and word limits', () => {
  it('accepts whole and half marks from 0.5 to 100', () => {
    expect(marksError('0.5')).toBeNull();
    expect(marksError('7.5')).toBeNull();
    expect(marksError('100')).toBeNull();
    expect(marksError('')).toBeNull();
  });

  it('rejects zero, over 100 and other fractions', () => {
    expect(marksError('0')).toBe('Enter marks from 0.5 to 100.');
    expect(marksError('100.5')).toBe('Enter marks from 0.5 to 100.');
    expect(marksError('7.25')).toBe('Use whole or half marks, such as 7.5.');
  });

  it('wants a whole word limit from 1 to 10,000', () => {
    expect(wordLimitError('1')).toBeNull();
    expect(wordLimitError('10000')).toBeNull();
    expect(wordLimitError('0')).toBe('Enter a whole number from 1 to 10,000.');
    expect(wordLimitError('10001')).toBe('Enter a whole number from 1 to 10,000.');
    expect(wordLimitError('2.5')).toBe('Enter a whole number from 1 to 10,000.');
  });
});

describe('validateDraft', () => {
  it('lets a half-written draft save', () => {
    expect(validateDraft(complete({ dueAt: '', questions: [emptyQuestion()] }))).toEqual({});
  });

  it('needs a subject and a title, and checks row shapes by request path', () => {
    const form = complete({
      subjectId: '',
      title: '  ',
      questions: [complete().questions[0], { ...emptyQuestion(), maxMarks: '0', wordLimit: '1.5' }],
    });
    expect(validateDraft(form)).toEqual({
      subjectId: 'Choose a subject.',
      title: 'Title is required.',
      'questions[1].maxMarks': 'Enter marks from 0.5 to 100.',
      'questions[1].wordLimit': 'Enter a whole number from 1 to 10,000.',
    });
  });
});

describe('publishChecklist', () => {
  it('passes every line for a complete assessment', () => {
    const items = publishChecklist(complete(), NOW, ['s1']);
    expect(items.every((item) => item.ok)).toBe(true);
    expect(publishErrors(items)).toEqual({});
  });

  it('fails a subject the professor no longer teaches, a past due date and an empty title', () => {
    const errors = publishErrors(publishChecklist(complete({ subjectId: 's9', title: '', dueAt: PAST }), NOW, ['s1']));
    expect(errors).toEqual({
      subjectId: 'Choose a subject you teach.',
      title: 'Add a title.',
      dueAt: 'The due date must be in the future.',
    });
  });

  it('fails a missing due date and an empty question list', () => {
    const errors = publishErrors(publishChecklist(complete({ dueAt: '', questions: [] }), NOW, ['s1']));
    expect(errors.dueAt).toBe('Set a due date.');
    expect(errors.questions).toBe('Add at least one question.');
  });

  it('has one line per incomplete question, linked to its first missing field', () => {
    const form = complete({
      questions: [
        complete().questions[0],
        { ...emptyQuestion(), text: 'Q2' },
        { ...emptyQuestion(), maxMarks: '5', wordLimit: '100' },
      ],
    });
    const failing = publishChecklist(form, NOW, ['s1']).filter((item) => !item.ok);
    expect(failing.map((item) => [item.path, item.text])).toEqual([
      ['questions[1].maxMarks', 'Question 2 needs max marks and a word limit.'],
      ['questions[2].text', 'Question 3 needs its text.'],
    ]);
  });

  it('fails more than 50 questions', () => {
    const questions = Array.from({ length: 51 }, () => complete().questions[0]);
    expect(publishErrors(publishChecklist(complete({ questions }), NOW, ['s1'])).questions).toBe('Remove questions: at most 50.');
  });
});

describe('request body', () => {
  it('sends ids, nulls for blanks, numbers and a UTC due date', () => {
    const form = complete({
      instructions: '  ',
      questions: [
        { ...emptyQuestion(), id: 'q1', text: 'Discuss.', maxMarks: '7.5', wordLimit: '300' },
        { ...emptyQuestion(), text: '', maxMarks: '', wordLimit: '' },
      ],
    });
    expect(requestFromForm(form)).toEqual({
      subjectId: 's1',
      title: 'Moot problem',
      instructions: null,
      dueAt: '2026-11-02T12:00:00.000Z',
      questions: [
        { id: 'q1', text: 'Discuss.', maxMarks: 7.5, wordLimit: 300 },
        { id: null, text: null, maxMarks: null, wordLimit: null },
      ],
    });
  });

  it('totals only valid marks', () => {
    const form = complete({
      questions: [
        { ...emptyQuestion(), maxMarks: '7.5' },
        { ...emptyQuestion(), maxMarks: '10' },
        { ...emptyQuestion(), maxMarks: '0.25' },
        emptyQuestion(),
      ],
    });
    expect(totalMarks(form)).toBe(17.5);
  });

  it('starts a new assessment with one empty question', () => {
    expect(emptyForm('s1').questions).toHaveLength(1);
    expect(emptyForm('s1').subjectId).toBe('s1');
  });
});
