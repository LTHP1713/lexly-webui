# Lexly Frontend (lexly-webui) — Progress

## Completed

### 2026-09-23 — Auth — Register & Login

**Status:** Done, verified against a headless-browser smoke test. Backend was not running
locally, so the two response status codes noted below are per the prompt's documented shape,
**not** verified against a live server — see Notes.

Scaffolded a new Vite + React + TypeScript web project (`lexly-webui`, sibling to `lexly-web`)
and built the registration/login flow against `com.lexly.auth.controller.AuthController`.

Files touched (all new):
- `src/api/client.ts` — typed `fetch` wrapper: reads `VITE_API_BASE_URL`
  (default `http://localhost:8080/api/v1`), attaches `Authorization: Bearer <accessToken>`,
  normalizes the `{ error, message }` error shape into `ApiError`, and retries a request once
  after a silent `/auth/refresh` on 401.
- `src/api/auth.ts` — `register` / `login` calls against the real endpoints.
- `src/auth/session-store.ts` — token/user storage, in plain module memory only (see Notes).
- `src/auth/AuthContext.tsx` — React context mirroring the session store
  (`useSyncExternalStore`), exposing `register` / `login` / `logout`.
- `src/auth/RequireAuth.tsx` — route guard, redirects anonymous visitors to `/login`.
- `src/auth/validation.ts` — client-side validation (email format, password ≥ 8 chars, full
  name required) plus a `mapServerFieldError` helper that parses the backend's
  `"field: reason"` `VALIDATION_ERROR` message onto the matching input.
- `src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterPage.tsx`,
  `src/pages/auth/AuthForm.module.css` — forms with `<label htmlFor>` on every input,
  `aria-invalid` + `aria-describedby` linking each field to its error, and an
  `aria-live="polite"` banner for top-level errors (network failure, `EMAIL_ALREADY_EXISTS`,
  etc.). Submit is disabled with "Logging in…" / "Creating account…" text while pending.
- `src/pages/DashboardPage.tsx` — placeholder authenticated home (`/dashboard`), shows the
  logged-in email and a logout button.
- `src/App.tsx`, `src/main.tsx` — router wiring (`/`→`/login`, `/login`, `/register`,
  `/dashboard` behind `RequireAuth`).
- `vite.config.ts`, `tsconfig.app.json` — `@/*` → `src/*` path alias.
- `.env.example` — `VITE_API_BASE_URL`.

Verified: `tsc -b` and `oxlint` both pass clean (one expected `react-refresh/only-export-components`
warning on `AuthContext.tsx` for exporting the `useAuth` hook alongside the provider — same
pattern used elsewhere, not a real issue). Drove the dev server with a headless Playwright
script: `/` redirects to `/login`, submitting the empty login form shows both field errors
(`aria-describedby`-linked), `/register` renders all three fields, and visiting `/dashboard`
while anonymous redirects back to `/login`. No console errors in any of it.

**Deviations from the prompt:**
- **Status codes not verified against a live backend.** No `lexly-backend` instance was
  reachable in this environment (`localhost:8080` refused connections), so the 400/401 shapes
  and the exact status code for `EMAIL_ALREADY_EXISTS` are implemented per the prompt's spec
  as given, unverified. `ApiError.status` is exposed on every error, so once a backend is
  reachable this is a one-time manual check (register the same email twice, read `err.status`)
  rather than a code change.
- **No persistence across reloads.** Per the prompt's instruction not to default to
  localStorage/sessionStorage for the refresh token either, both tokens live only in
  `session-store.ts`'s module memory — a full page reload always logs the user out. Flagging
  this explicitly as the deferred decision the prompt asked for, rather than picking a storage
  mechanism unasked. Options for a follow-up: an httpOnly cookie set by the backend (best, but
  needs backend support), or an in-memory refresh with a backend-driven "remember me" opt-in.

## In Progress

_Nothing in flight._

## Blocked

_Live backend verification of the two status codes above (see Deviations) is blocked on a
running `lexly-backend` instance — nothing else is blocked._

## Next Up

- Once `lexly-backend` is running locally, do the live status-code check described above and
  update this entry if either code differs from the prompt's spec.
- Decide and implement the reload-persistence follow-up (see Deviations).
- Build out the real `/dashboard` (this prompt only asked for a placeholder).
