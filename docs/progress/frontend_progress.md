# Lexly Frontend (lexly-webui) — Progress

## Completed

### 2026-10-05 — Home dashboard, Case Laws, Practice/Profile shells

**Status:** Frontend done. Verified with a headless Playwright run against the dev server, with
every backend endpoint mocked through route interception (no live backend was running). Three
Home sections wait on backend endpoints that don't exist yet. The contract for those endpoints is
in [docs/HOME_DASHBOARD_API_CONTRACT.md](../HOME_DASHBOARD_API_CONTRACT.md).

What was built:
- **Home (`/dashboard`)** replaces the placeholder. Sections in order: greeting, universal
  search, Bare Acts / Case Laws / Practice quick actions, Practice Progress (SVG donut), Bare Acts
  Progress, Continue Learning. Each card loads and fails on its own.
- **App shell:** a sticky header (brand, Home / Subjects / Practice, notifications bell, profile
  avatar) and a fixed bottom tab bar below 768px (Home / Subjects / Practice / Profile) with
  safe-area padding. "Subjects" goes to `/acts` until a Subjects feature exists. The bell shows
  "No notifications". The ivory/navy palette and `color-scheme: light` apply only inside
  `AppLayout`, so the auth screens are unchanged.
- **`/caselaws` and `/caselaws/:id`** use the existing `GET /caselaws` and `GET /caselaws/{id}`:
  - The list has search (300 ms debounce), an importance filter and pagination. Filters live in
    the URL, and an optional `sectionId` filter is supported.
  - The detail page shows the summary and related-section links. A 403 `PRO_REQUIRED` renders a
    locked teaser, the same way sections do.
  - `sourcePdfUrl` is only rendered when it is an http(s) URL.
- **`/practice`** is a coming-soon placeholder. **`/profile`** shows the email and Log Out.
  Log Out moved here from the header.

How the missing endpoints are handled:
- `src/config/features.ts` defines one env flag per missing endpoint, all off by default (see
  `.env.example`). While a flag is off, the hook (`usePracticeStats`, `useBareActProgress`,
  `useContinueLearning`, `useCurrentUser`) returns `unavailable` without making a request. The
  card then shows "…will appear here once tracking is available." Shipping an endpoint means
  setting its flag to `true`; no component changes are needed.
- `src/api/users.ts` holds the target DTOs and the mappers (`toPracticeSummary` etc.), so
  components only see UI models.
- `src/api/search.ts → universalSearch()` is the single switch point for search. Today it fans
  out to `/sections/search`, `/caselaws?q=` and `/acts` with `Promise.allSettled`:
  - The acts list is fetched once per session and filtered on the client.
  - If one source fails, the other groups still show, with a "couldn't be searched" note.
  - With `VITE_API_UNIFIED_SEARCH=true` it calls `GET /search` instead.
- The section and case-law detail pages call `POST /users/me/learning-activity` when opened with
  full access, behind the same flag.
- `src/dev/homeMocks.ts` provides dev-only sample data via `VITE_HOME_MOCKS=populated|empty|error|loading`.
  Each card it fills shows a "Sample data" badge. Production builds never include it; this was
  checked against `dist/`.

Verified with `tsc -b`, `oxlint` (only the existing `AuthContext.tsx` warning), `vite build`,
and Playwright at 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800 and 1440×900:
- No horizontal overflow, no touch target under 40px on phones, and the bottom nav never
  covers the last card.
- On phones, Practice Progress starts at 396px, inside the first screen.
- Search sends no request for 1 character and 1 section-search request while typing
  "contract". Results are grouped Sections / Case Laws / Bare Acts.
  - ArrowDown + Enter opens a result with "← Back to Home".
  - Enter with no highlighted result goes to `/search?q=…`.
- Quick actions and both navs route correctly. Notifications, profile and logout work.
- Empty states (0 attempts, `{acts: []}`, 204 continue-learning), a failed card that leaves the
  others intact, flags-off states (no `/users/me*` requests) and the dev sample-data badges were
  all checked.
- The existing Acts page renders inside the new shell. No console errors.

**Notes / decisions:**
- **Greeting.** It has no name until `GET /users/me` returns `firstName`. The name is never
  derived from the email.
- **Search adapter limits.** Section hits from `/sections/search` don't include their act's name,
  so the subtitle reads "Bare Act section". The unified endpoint adds the act name. Topics and
  Questions are left out until the backend supports them.
- **Removed:** `src/pages/DashboardPage.tsx` (the placeholder). The staged copy in the git index
  was left alone.

### 2026-09-23 — Content — Browse Bare Acts & Sections

**Status:** Done, verified end-to-end against a **live** local `lexly-backend` (seed data: The
Indian Contract Act, 1872 — 6 sections, 4 locked) with a headless Playwright script (25/25
checks pass). The cases the seed data can't produce were mocked with Playwright route
interception in the same run: a section with illustrations/exceptions, multi-page search,
a 500 on search, and 401 + failed refresh.

Screens (all behind `RequireAuth`, inside a new shared `AppLayout`):
- `/acts` — `GET /acts`, each act links to its sections.
- `/acts/:actId` — `GET /acts/{actId}/sections`. Every section is rendered, locked ones included:
  muted style + a lock icon and a visible "Pro" label (screen readers hear "Locked, requires
  Pro"). Locked items stay clickable links.
- `/sections/:sectionId` — `GET /sections/{sectionId}`. A 200 renders `bodyText` plus
  "Illustrations" and "Exceptions" as separate labelled `<ol>`s in the order returned. A 403
  `PRO_REQUIRED` renders a locked card built from the teaser (`sectionNumber`, `title`) with the
  response's `message` as the upsell text. This case is a normal result, not an error.
- `/search` — `GET /sections/search`: 300 ms debounce, 20 per page, Previous/Next pagination
  using `totalPages`. Separate loading, empty (`totalElements === 0`), and error states. The
  query and page live in the URL (`?q=…&page=…`, page 1-based) so browser back and the
  "Back to search results" link restore the same results.

Files touched:
- `src/api/client.ts` — `ApiError` now also carries the raw parsed error `body` (optional 4th
  constructor arg). This is the only change to the shared client; it's needed because the 403
  teaser fields sit next to `error`/`message`.
- `src/api/content.ts` (new) — typed `listActs`, `listSections`, `getSection`, `searchSections`.
  `getSection` turns a 403 `PRO_REQUIRED` into a `{ access: 'locked', teaser }` result.
- `src/hooks/useApiQuery.ts` (new) — small keyed fetch hook: loading/success/error, `retry`,
  drops responses for a superseded key, and keeps `staleData` so search results stay on screen
  (dimmed, `aria-busy`) while the next page loads.
- `src/components/AppLayout.tsx` + `.module.css` (new) — skip link, `<header>` with a
  `<nav aria-label="Primary">` (Home / Bare Acts / Search), account email + logout, `<main>`.
- `src/components/QueryStates.tsx` + `.module.css` (new) — skeleton `LoadingState`
  (`role="status"`, respects `prefers-reduced-motion`) and `ErrorState` (`role="alert"`, shows
  `ApiError.message` only, with a "Try again" button).
- `src/pages/content/` (new) — `ActsPage.tsx`, `SectionsPage.tsx`, `SectionDetailPage.tsx`,
  `SearchPage.tsx`, `ProBadge.tsx`, `HighlightedSnippet.tsx`, `navigation.ts` (router-state types
  + `sectionLabel`), `Content.module.css`.
- `src/App.tsx` — new routes nested under a `RequireAuth` + `AppLayout` layout route;
  `/dashboard` moved inside it too.
- `src/pages/DashboardPage.tsx` — dropped its own logout button (it's now in the header) and
  inline padding; added links to acts and search.
- `src/index.css` — global `:focus-visible` outline so every link and button has a visible
  focus state.

Verified: `tsc -b` clean and `oxlint` clean (only the pre-existing `AuthContext.tsx` warning).
The Playwright run checked:
- **Structure:** one `<h1>` per screen, `header` and `main` landmarks, and `<ul>`/`<li>` lists.
- **Keyboard:** Tab reaches the section links, and the focus outline is visible.
- **Locked sections:** all 6 sections render, 4 with the Pro badge. A locked section shows the
  teaser h1 and the backend's upsell message, with no error alert.
- **Section detail:** the mocked illustrations kept their returned order.
- **Errors:** an unknown act's 404 shows "No bare act found with id …" (no JSON).
- **Search:** typing "contract" one letter at a time sent 1 request, not 8. The empty state,
  pagination (`page=1` sent) and the error message from `message` all work.
- **Auth:** a 401 followed by a failed refresh redirects to `/login`.
- **Console:** no unexpected errors.

**Notes / decisions:**
- **Search redaction gap confirmed live.** The locked result (s.56) came back with a full
  snippet. As instructed, the UI renders whatever the backend returns: locked hits get the same
  Pro badge + muted style as the sections list, and the snippet is shown as returned. Nothing in
  the frontend assumes the snippet can be withheld. Once the backend redacts it, locked hits
  simply show less text, and an empty snippet is already handled (the line is omitted).
- **Snippets contain `<b>…</b>` highlight markup** (not in the prompt's spec; seen in the live
  response). `HighlightedSnippet` handles only those two tags, turning the text between them
  into `<mark>`. Everything else stays plain text, and `dangerouslySetInnerHTML` is never used.
- **No "Upgrade" button on the locked card yet.** The upsell is the backend's `message` plus a
  "part of Lexly Pro" line. A button would need to point at `/subscriptions`, which is out of
  scope for this prompt. Add the button when the subscriptions screen exists.
- **Back navigation.** The section-detail response has no act id, so list/search links pass a
  `backTo` in router state. Without it (e.g. a deep link) the page falls back to "Back to all
  acts". `/acts/:actId` likewise gets the act title from router state, and otherwise looks it
  up via `/acts`. That lookup is allowed to fail without breaking the page.
- **Dark mode** is not handled. Like the auth pages, these screens use a fixed light palette
  while `index.css` declares `color-scheme: light dark`. On a dark OS theme some text may have
  poor contrast. This should be fixed app-wide rather than per page.
- A throwaway account `webui-smoke-1790167432@example.com` was registered on the local backend
  for the smoke test.

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

_Nothing blocked._ The auth status-code check from the Register & Login entry was done on
2026-09-23 against the live local backend: registering an existing email returns **409**
`{ "error": "EMAIL_ALREADY_EXISTS", "message": … }`, and a wrong password returns **401**
`{ "error": "UNAUTHORIZED", "message": "Invalid email or password" }`. Both use the
`{ error, message }` shape the client already handles, so no code change was needed.

## Next Up

- Add an "Upgrade to Pro" action to the locked-section card once the subscriptions screen exists.
- Choose an app-wide dark-mode approach (see the Content entry's notes).
- Decide and implement the reload-persistence follow-up (see Deviations).
- Backend: implement docs/HOME_DASHBOARD_API_CONTRACT.md (order: §G/§D/§F → §A → §C → §B), then
  flip the matching `VITE_API_*` flags.
- Build the Practice flow (question banks → attempt → result) against §H–§K.
- Build the Subjects feature and repoint the "Subjects" nav item.
