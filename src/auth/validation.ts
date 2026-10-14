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

/** College mode (contract §1.2): the server upper-cases the code and trims the ID, but both are required. */
export function validateCollegeLogin(values: { collegeCode: string; loginId: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.collegeCode.trim()) errors.collegeCode = 'College code is required.';
  if (!values.loginId.trim()) errors.loginId = 'Roll no. or employee ID is required.';
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
  const knownFields = ['email', 'password', 'fullName', 'collegeCode', 'loginId'];
  if (!knownFields.includes(field)) return undefined;
  return { [field]: reason };
}

// ---------- Change password (contract §1.5, UI spec F1.2) ----------

export const CHANGE_PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;

/** Copy for the server's `VALIDATION_ERROR` reasons (contract §1.5, UI spec F1.2). */
const SERVER_COPY: Record<string, string> = {
  'currentPassword: is incorrect': 'Your current password is incorrect.',
  'newPassword: must be different from the current password': 'Choose a password different from your current one.',
  'newPassword: must not be your login ID': "Don't use your roll no. or employee ID as your password.",
  'newPassword: must be at least 8 characters': 'Use at least 8 characters.',
};

export function validateChangePassword(
  values: { currentPassword: string; newPassword: string; confirmPassword: string },
  loginId: string | null,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.currentPassword) errors.currentPassword = 'Enter your current password.';
  if (!values.newPassword) errors.newPassword = 'Enter a new password.';
  else if (values.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.';
  else if (values.newPassword === values.currentPassword) {
    errors.newPassword = 'Choose a password different from your current one.';
  } else if (loginId && values.newPassword === loginId) {
    errors.newPassword = "Don't use your roll no. or employee ID as your password.";
  }
  if (!errors.newPassword && values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Passwords don't match.";
  }
  return errors;
}

/** `path: reason, path: reason` → field errors for the known fields; null if nothing matched. */
export function mapChangePasswordErrors(message: string): FieldErrors | null {
  const errors: FieldErrors = {};
  for (const part of message.split(/, (?=\w+: )/)) {
    const match = /^(\w+): (.+)$/.exec(part.trim());
    if (!match || !(CHANGE_PASSWORD_FIELDS as readonly string[]).includes(match[1])) continue;
    errors[match[1]] ??= SERVER_COPY[`${match[1]}: ${match[2]}`] ?? sentence(match[2]);
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

function sentence(reason: string): string {
  const text = reason.charAt(0).toUpperCase() + reason.slice(1);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
