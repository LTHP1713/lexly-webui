/** Mirrors the backend's bean validation on RegisterRequest/LoginRequest so obviously-bad
 * input never round-trips to the server. The backend stays the source of truth for anything
 * beyond this (e.g. duplicate email) — those errors surface from the API response instead. */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Record<string, string>;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return undefined;
}

export function validateFullName(fullName: string): string | undefined {
  if (!fullName.trim()) return 'Full name is required.';
  return undefined;
}

export function validateRegister(values: { email: string; password: string; fullName: string }): FieldErrors {
  const errors: FieldErrors = {};
  const email = validateEmail(values.email);
  const password = validatePassword(values.password);
  const fullName = validateFullName(values.fullName);
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (fullName) errors.fullName = fullName;
  return errors;
}

export function validateLogin(values: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Password is required.';
  return errors;
}

/**
 * Maps a backend VALIDATION_ERROR message like "email: must be a well-formed email address"
 * onto the matching field. Falls back to a top-level banner when the shape doesn't match.
 */
export function mapServerFieldError(message: string): FieldErrors | undefined {
  const match = /^(\w+):\s*(.+)$/.exec(message);
  if (!match) return undefined;
  const [, field, reason] = match;
  const knownFields = ['email', 'password', 'fullName'];
  if (!knownFields.includes(field)) return undefined;
  return { [field]: reason };
}
