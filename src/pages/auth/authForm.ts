import { ApiError } from '@/api/client';
import type { SessionEndReason } from '@/auth/session-store';

/** Which sign-in screen an error came from; the two login tabs word a 401 differently. */
export type AuthFlow = 'login' | 'college-login' | 'register';

/**
 * Turns a failed login/register call into a sentence a user can act on (UI spec §0.6, F1.1).
 * Branches on the error code; the backend's own `message` is never shown verbatim. Every
 * credential failure is one generic 401 (contract §1.2), so the copy never says which part was
 * wrong. Field-level VALIDATION_ERRORs are mapped onto inputs by the pages before this is reached.
 */
export function describeAuthError(err: unknown, flow: AuthFlow): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (err.code) {
    case 'NETWORK_ERROR':
      return 'Unable to connect. Please check your connection and try again.';
    case 'EMAIL_ALREADY_EXISTS':
      return 'An account with this email already exists.';
    case 'UNAUTHORIZED':
      if (flow === 'college-login') return 'Incorrect college code, ID or password.';
      if (flow === 'login') return 'Incorrect email or password.';
      break;
    case 'COLLEGE_INACTIVE':
      return "Your college's account is inactive. Contact your administrator.";
    case 'RATE_LIMITED':
      return 'Too many requests, try again shortly.';
    case 'VALIDATION_ERROR':
      return 'Please check the details you entered and try again.';
  }
  if (err.status >= 500) return 'Lexly is having trouble right now. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

/** Why the login screen opened after a session ended on its own (UI spec F1 session rules). */
export function describeEndReason(reason: SessionEndReason): string | null {
  if (reason === 'expired') return 'Your session has ended. Please sign in again.';
  if (reason === 'college-inactive') return "Your college's account is inactive. Contact your administrator.";
  return null;
}

export function isEmailTaken(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'EMAIL_ALREADY_EXISTS';
}

/** Moves focus to the first invalid input so keyboard and screen-reader users land on the problem. */
export function focusFirstError(errors: Record<string, string>, order: string[]) {
  const first = order.find((field) => errors[field]);
  if (first) document.getElementById(first)?.focus();
}
