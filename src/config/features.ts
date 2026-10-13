/**
 * Backend endpoints the Home dashboard was built against. Apart from `/users/me`, they aren't in
 * TDD v2 and won't be built (docs/Lexly-API-Contract.md §15), so their flags stay off (decision
 * D3). While off, the matching hook reports `unavailable` without making a request and the UI shows
 * its "not tracked yet" state. Setting an env var to `true` needs no component changes.
 */
function flag(value: string | undefined): boolean {
  return value === 'true';
}

export const backendFeatures = {
  /** `GET /users/me` — supplies `firstName` for the greeting. */
  currentUser: flag(import.meta.env.VITE_API_USERS_ME),
  /** `GET /search` — replaces the frontend fan-out over /sections/search, /caselaws, /acts. */
  unifiedSearch: flag(import.meta.env.VITE_API_UNIFIED_SEARCH),
  /**
   * `GET /users/me/bare-act-progress`, `GET /users/me/continue-learning` and
   * `POST /users/me/learning-activity` — one flag because they share the same tracking tables.
   */
  learningProgress: flag(import.meta.env.VITE_API_LEARNING_PROGRESS),
} as const;

/**
 * Development-only sample data for visually checking populated/empty/error/loading Home states.
 * Ignored in production builds (`import.meta.env.DEV` is false there).
 */
export type HomeMockMode = 'populated' | 'empty' | 'error' | 'loading';

export const homeMockMode: HomeMockMode | null = (() => {
  if (!import.meta.env.DEV) return null;
  const mode = import.meta.env.VITE_HOME_MOCKS;
  return mode === 'populated' || mode === 'empty' || mode === 'error' || mode === 'loading' ? mode : null;
})();
