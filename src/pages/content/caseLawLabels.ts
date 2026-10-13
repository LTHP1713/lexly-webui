/**
 * Display strings for the code-like values in case law responses (`caseType`,
 * `finalHolding.outcome`, `arguments` party keys). Known values use a label map; anything else
 * goes through `humanizeCode`, so a new backend value still reads sensibly.
 */

const UPPER_SNAKE = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

/**
 * `SIR_UPHELD_WITH_DIRECTIONS` → "Sir upheld with directions". Text that isn't UPPER_SNAKE
 * (e.g. "Appeal dismissed") is already for display and passes through untouched.
 */
export function humanizeCode(value: string): string {
  const trimmed = value.trim();
  if (!UPPER_SNAKE.test(trimmed)) return value;
  const words = trimmed.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function labelFrom(labels: Record<string, string>, value: string): string {
  return labels[value.trim()] ?? humanizeCode(value);
}

const CASE_TYPE_LABELS: Record<string, string> = {
  WRIT_PETITION: 'Writ Petition',
  CIVIL_APPEAL: 'Civil Appeal',
  CRIMINAL_APPEAL: 'Criminal Appeal',
  SPECIAL_LEAVE_PETITION: 'Special Leave Petition',
  TRANSFER_PETITION: 'Transfer Petition',
  REVIEW_PETITION: 'Review Petition',
  CURATIVE_PETITION: 'Curative Petition',
  ORIGINAL_SUIT: 'Original Suit',
  REFERENCE: 'Reference',
};

/** Suggestions for the admin case type field; any other value is still accepted. */
export const KNOWN_CASE_TYPES = Object.keys(CASE_TYPE_LABELS);

export function caseTypeLabel(value: string): string {
  return labelFrom(CASE_TYPE_LABELS, value);
}

export function outcomeLabel(value: string): string {
  return humanizeCode(value);
}

const PARTY_LABELS: Record<string, string> = {
  PETITIONER: 'Petitioner',
  APPELLANT: 'Appellant',
  RESPONDENT: 'Respondent',
  STATE: 'State',
  INTERVENOR: 'Intervenor',
  AMICUS: 'Amicus Curiae',
};

/** Unknown party keys are title-cased (`CAVEATOR` → "Caveator", `NEXT_FRIEND` → "Next Friend"). */
export function partyLabel(value: string): string {
  return (
    PARTY_LABELS[value] ??
    value
      .toLowerCase()
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}
