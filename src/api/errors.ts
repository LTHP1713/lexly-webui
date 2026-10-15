/**
 * Error-code catalogue (plan §3.6, copy from UI spec §0.6). Screens switch on `ApiError.code`,
 * never on `message` or the HTTP status; this module turns a code into the sentence to show and,
 * for the `*_ALREADY_EXISTS` codes, the request field it belongs under.
 */
import { ApiError } from '@/api/client';

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  COLLEGE_INACTIVE: 'COLLEGE_INACTIVE',
  RATE_LIMITED: 'RATE_LIMITED',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  SHORT_CODE_ALREADY_EXISTS: 'SHORT_CODE_ALREADY_EXISTS',
  SECTION_NUMBER_ALREADY_EXISTS: 'SECTION_NUMBER_ALREADY_EXISTS',
  COLLEGE_CODE_ALREADY_EXISTS: 'COLLEGE_CODE_ALREADY_EXISTS',
  LOGIN_ID_ALREADY_EXISTS: 'LOGIN_ID_ALREADY_EXISTS',
  SUBJECT_CODE_ALREADY_EXISTS: 'SUBJECT_CODE_ALREADY_EXISTS',
  IMPORT_FILE_INVALID: 'IMPORT_FILE_INVALID',
  SUBJECT_IN_USE: 'SUBJECT_IN_USE',
  ASSESSMENT_NOT_EDITABLE: 'ASSESSMENT_NOT_EDITABLE',
  ASSESSMENT_CLOSED: 'ASSESSMENT_CLOSED',
  ANSWER_LOCKED: 'ANSWER_LOCKED',
  INVALID_FILE: 'INVALID_FILE',
  /** Client-side: the request never reached the server. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Client-side: an upload or download was cancelled through its `AbortSignal`. */
  ABORTED: 'ABORTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const MESSAGES: Partial<Record<string, string>> = {
  NETWORK_ERROR: 'Unable to connect. Please check your connection and try again.',
  VALIDATION_ERROR: 'Please check the details you entered and try again.',
  UNAUTHORIZED: 'Your session has ended. Please sign in again.',
  FORBIDDEN: "You don't have access to this page.",
  NOT_FOUND: 'This item no longer exists. The list has been refreshed.',
  RATE_LIMITED: 'Too many requests, try again shortly.',
  COLLEGE_INACTIVE: "Your college's account is inactive. Contact your administrator.",
  EMAIL_ALREADY_EXISTS: 'This email is already used by another Lexly account.',
  SHORT_CODE_ALREADY_EXISTS: 'Another act already uses this short code.',
  SECTION_NUMBER_ALREADY_EXISTS: 'This act already has a section with this number.',
  COLLEGE_CODE_ALREADY_EXISTS: 'Another college already uses this code.',
  LOGIN_ID_ALREADY_EXISTS: 'Another student or professor at your college already uses this ID.',
  SUBJECT_CODE_ALREADY_EXISTS: 'Another subject at your college already uses this code.',
  ABORTED: 'Cancelled.',
  ASSESSMENT_NOT_EDITABLE: "This assessment has been published or removed, so it can't be edited any more.",
  ASSESSMENT_CLOSED: "The due date has passed, so this answer can't be changed.",
  ANSWER_LOCKED: 'This answer was already submitted.',
};

const SERVER_TROUBLE = 'Lexly is having trouble right now. Please try again in a moment.';
const FALLBACK = 'Something went wrong. Please try again.';

/** A friendly sentence for any thrown value. Never the raw backend body. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return FALLBACK;
  const known = MESSAGES[err.code];
  if (known) return known;
  if (err.code === ErrorCode.INTERNAL_ERROR || err.status >= 500) return SERVER_TROUBLE;
  return FALLBACK;
}

/** The request field a uniqueness conflict belongs under, so forms can show it inline. */
const CONFLICT_FIELDS: Partial<Record<string, string>> = {
  EMAIL_ALREADY_EXISTS: 'email',
  SHORT_CODE_ALREADY_EXISTS: 'shortCode',
  SECTION_NUMBER_ALREADY_EXISTS: 'sectionNumber',
  COLLEGE_CODE_ALREADY_EXISTS: 'code',
  LOGIN_ID_ALREADY_EXISTS: 'loginId',
  SUBJECT_CODE_ALREADY_EXISTS: 'code',
};

/** `{ field: message }` for a `*_ALREADY_EXISTS` error, else `null`. */
export function conflictFieldError(err: unknown): Record<string, string> | null {
  if (!(err instanceof ApiError)) return null;
  const field = CONFLICT_FIELDS[err.code];
  return field ? { [field]: MESSAGES[err.code] ?? FALLBACK } : null;
}

export function hasCode(err: unknown, code: ErrorCode): err is ApiError {
  return err instanceof ApiError && err.code === code;
}
