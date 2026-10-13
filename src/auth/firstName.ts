/**
 * The name a student is greeted by: the backend's `firstName` when set, otherwise the first
 * word of `fullName`. Returns `null` when neither is available — never derived from the email.
 */
export function firstNameFrom(source: { firstName?: string | null; fullName?: string | null }): string | null {
  const firstName = source.firstName?.trim();
  if (firstName) return firstName;
  const firstWord = source.fullName?.trim().split(/\s+/)[0];
  return firstWord || null;
}
