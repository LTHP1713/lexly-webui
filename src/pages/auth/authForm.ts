import { ApiError } from '@/api/client';

/**
 * Turns a failed login/register call into a sentence a student can act on. The backend's own
 * `message` is never shown verbatim here — for a 401 with no JSON body it falls back to the HTTP
 * status text ("Unauthorized"). Field-level VALIDATION_ERRORs are mapped onto inputs by the pages
 * (`mapServerFieldError`) before this is reached.
 */
export function describeAuthError(err: unknown, flow: 'login' | 'register'): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.code === 'NETWORK_ERROR') return 'Unable to connect. Please check your connection and try again.';
  if (err.code === 'EMAIL_ALREADY_EXISTS' || (flow === 'register' && err.status === 409)) {
    return 'An account with this email already exists.';
  }
  if (flow === 'login' && err.status === 401) return 'Incorrect email or password.';
  if (err.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (err.code === 'VALIDATION_ERROR' || err.status === 400) {
    return 'Please check the details you entered and try again.';
  }
  if (err.status >= 500) return 'Lexly is having trouble right now. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

export function isEmailTaken(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'EMAIL_ALREADY_EXISTS' || err.status === 409);
}

/** Moves focus to the first invalid input so keyboard and screen-reader users land on the problem. */
export function focusFirstError(errors: Record<string, string>, order: string[]) {
  const first = order.find((field) => errors[field]);
  if (first) document.getElementById(first)?.focus();
}
