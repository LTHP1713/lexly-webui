# Lexly Frontend (lexly-webui) — Progress

## Completed

### 2026-10-16 — F3 Assessments & answering (F3.1–F3.8, F3.10; F3.9 dropped)

**Status:** Done 2026-10-16. Backend Phase 3 is merged to `main` (`75a7c08`, PR #4); the
contract copy here is identical to the backend's. Branch `feature/f3-assessments`. Lint (one
pre-existing warning), `tsc -b`, the build and 176 unit tests pass.

**Verified against the live backend** (`lexly-backend` `main` at `75a7c08`). The backend that
was running was a pre-Phase-3 build (`No endpoint GET /api/v1/professor/assessments`, which is
why the professor home showed an error), so I restarted it from `main`; Flyway applied V19.
`e2e/f3-assessments.spec.ts` (5 tests, desktop) passes and covers the plan's "Done when": a
10-question assessment is published (after the checklist blocked an incomplete one); a student
uploads 8 answers, replaces one, views it, and submits 7; at the due date the page turns
read-only by itself and shows 3 "Not attempted"; after the close job the professor sees
"7 of 20" submitted, 13 not attempted, and Asha's grid row with 7 Submitted and 3 Not attempted;
the student screens pass a phone check. The full suite: 36 passed, 24 skipped by design, 0 failed.

What changed:
- **API:** `api/assessments.ts` (shared types, mappers), `api/professor.ts` (§9.2, §9.5 grid),
  `api/student.ts` (§9.3–9.4, upload via `apiClient.upload` with progress, `checkAnswerFile`:
  PDF type/name, empty, `maxFileMb`, `%PDF-`). Four P3 error codes in `errors.ts`.
- **Shared:** `AssessmentStatusBadge`, `StudentStateBadge`, `CellStatusLabel`
  (`assessmentLabels.ts` holds the label maps), `Deadline` + `lib/deadline.ts` (`timeLeft`,
  `clockOffset`, `useNow`: 30 s ticks, 1 s in the last minute, paused while hidden),
  `NumberField` / `DateTimeField` (`lib/dateTimeLocal.ts`), `PdfViewer` (blob URL, revoked on
  close), `formatMarks`.
- **Professor:** `/professor` list (F3.1), `/professor/assessments/new` and `/:id/edit` editor
  with the live "Before you publish" checklist, save-then-confirm publish, delete (F3.2–F3.4),
  `/professor/assessments/:id` detail with stat tiles, questions, Remove, and the submissions
  grid (sticky header/column, icon + text cells, question/status/page in the URL, search in
  state only; cards on phones) (F3.8). Wide layout for `/professor/**`.
- **Student:** `/student` grouped list (To do / Submitted / Closed, subject + page in the URL)
  (F3.5); `/student/assessments/:id` answer cards with the §6.2 states, upload with progress +
  Cancel, Replace, Submit confirm, View, each card error from the spec table, and the
  server-corrected clock that turns the page read-only at the due date and refetches (F3.6–F3.7).
- **Removed:** the F2.8 placeholder homes and `SubjectCards` (the spec replaces them with the
  list filters), and their two unit tests; `e2e/f2-college.spec.ts` now checks the filters.
- **Audit:** `ASSESSMENT_PUBLISHED` / `ASSESSMENT_REMOVED` summaries per the spec.
- **Tests (F3.10):** `deadline.test.ts` (countdown boundaries, clock offset),
  `assessmentForm.test.ts` (draft checks, checklist, body), `professor.test.tsx` (list, blocked
  publish, save → confirm → publish, publish `VALIDATION_ERROR` on fields, `/edit` of a published
  one, `ASSESSMENT_NOT_EDITABLE`, Not Found, grid + question filter, remove),
  `student.test.tsx` (grouping, not uploaded → uploaded → submitted, non-PDF refused,
  `INVALID_FILE`, `ANSWER_LOCKED`, `ASSESSMENT_CLOSED`, submit without upload, closed view,
  server clock, Not Found), audit summaries. `e2e/f3-assessments.spec.ts` runs the plan's "Done
  when" (10 questions, 7 submitted + 1 uploaded-only, 3 Not attempted, the grid after the close
  job) plus a phone pass.

Notes:
- jsdom's XHR drops multipart filenames before MSW sees them, so the unit test checks the part's
  bytes; `uploadAnswer` passes the filename to `FormData.append` explicitly.
- Found while testing, not changed: `ErrorState` shows the server's `message` (e.g. "No endpoint
  GET …"), as it has since F0. CLAUDE.md says to map codes to friendly text.
- E2E fixes found on the live run: the student test needs a 6-minute timeout (it waits for
  the due date), and grid cells are counted by their "✓Submitted" text (icon and text share one
  element).

### 2026-10-14 — F2 College administration (F2.1–F2.9)

**Status:** Done 2026-10-14. Backend `feature/phase2` was merged to `main` (`676ea65`, PR #3, same
code as `389d70e`), and `npm run test:e2e` was re-run against it (see below). Branch
`feature/f2-college-admin`, merged into `master`. Lint (one pre-existing warning), `tsc -b`, the build and 136 unit
tests pass.

What changed:
- **F2.1 React Query** (`@tanstack/react-query`, D1): `lib/queryClient.ts` (client, `queryKeys`,
  the cache is cleared whenever the signed-in user changes) and `hooks/useCachedQuery.ts`, which
  returns `useApiQuery`'s result shape so screens keep their loading/stale/error rendering. The
  F1 **lists** moved to it (colleges, college admins, admin acts, an act's sections, admin case
  laws, audit and its college filter). The F1 detail loaders and form loaders stay on
  `useApiQuery`: they copy the first response into local state, so a cached copy could seed a
  stale form.
- **Shell:** C_ADMIN nav Users · Subjects · Audit · Library (new `UsersIcon`); `/college` is now a
  hub (college name, code chip, three link cards); Users sub-nav People · Import; wide layout for
  `/college/**` except the import page.
- **F2.2–F2.5 Users:** `/college/users` (Students/Professors tabs with arrow keys, search, sort and
  page in the URL, table from 768 px and cards below, row menu); `/college/users/:id` (facts,
  details, the professor's subjects, Edit · Reset password · Remove; 404 → Not Found). Dialogs in
  `userDialogs.tsx`: add/edit with `LOGIN_ID_ALREADY_EXISTS` / `EMAIL_ALREADY_EXISTS` on their
  fields (plus the "import to convert" sentence when adding a student), reset password, and
  remove with the typed login ID and per-role consequences. Every change refreshes the user
  lists, that user's detail and the subjects (`userQueries.ts`); a removal drops the detail from
  the cache instead of refetching it.
- **F2.6 Import:** `/college/users/import` with the kind in the URL, templates copied from the
  backend's `docs/templates/` to `public/templates/`, the new `FileDropzone` (a button that also
  takes drops; extension, empty and 5 MB checks before upload), upload progress then "Checking
  rows…", and `ImportResultTable` with spreadsheet row numbers, a "Roll no"/"Employee ID" key
  column and the `CONVERTED` note. `IMPORT_FILE_INVALID` and the server's 5 MB error show under
  the file.
- **F2.7 Subjects:** `/college/subjects` (search in the URL; "None" professors in the warning
  colour) and `/college/subjects/:id` (description with its line breaks, the professors card).
  Add/edit (code upper-cased; `SUBJECT_CODE_ALREADY_EXISTS` on the field; adding opens the
  detail), a searchable professor multi-select whose selection survives new searches (chips),
  and delete with the `SUBJECT_IN_USE` / has-assessments variant that offers Rename.
- **F2.8:** `SubjectCards` on `/professor` ("My subjects", with "With {other professors}") and
  `/student` ("Subjects at your college").
- **Audit summaries** for the P2 `details`: login ID + role, "Professor account · EMP7",
  "Students: 2 created, 1 converted, …", "CON-101 · 2 professors".
- **Shared:** `DialogForm.tsx` (`DialogButtons`, `Banner`) and `lib/forms.ts` (`saveErrors`), moved
  out of the F1 college dialogs; `TypedConfirmDialog` has a `busyLabel`; `ImportResultTable`
  takes `rowNumber`, `keyLabel` and `rowNote`; `BulkImportResult` has `summary.converted`;
  `errors.ts` has the four P2 codes; `formatBytes`.
- **Tests (F2.9):** unit tests for the user and subject API modules and the file checks; route
  tests for the users list and tabs, add-dialog conflicts, the remove dialog needing the exact
  login ID, Not Found for another college's user and subject, all four import outcomes, a
  whole-file error, the subject create/duplicate/professor mapping/in-use flows and the
  read-only cards. `findBy*` now waits 5 s (`src/test/setup.ts`): each route test re-imports the
  app, and full runs were timing out on this machine.

**Verified against the live backend** (`lexly-backend` `feature/phase2` at `389d70e`; the running
backend was an older build without `/college/**`, so I restarted it from that branch, and
Flyway applied V18). `e2e/f2-college.spec.ts` (8 tests, desktop) passes. It covers the plan's
"Done when": the C_ADMIN imports professors, then a students file with a duplicate roll no, a bad
email and an S_STUDENT's email. The result is "2 created · 1 converted · 2 rejected · 0 failed, out
of 5", with spreadsheet row numbers and the converted note; a wrong header gives the whole-file
error. The admin then adds a user (duplicate ID → field error), resets a password, removes a
student by typing the roll no, opens a made-up user id (Not Found), creates a subject, maps two
professors through the search, and deletes a second subject. An imported student signs in with
the college code + roll no (forced change, then sees the subject on `/student`), the converted
account signs in with its roll no, and a professor sees "My subjects" with the co-professor. The
audit log shows the import and mapping summaries, and the college pages pass at 390 px (cards,
no sideways scroll). axe runs on every screen. The full suite (`npm run test:e2e`): 31 passed, 19
skipped by design, 0 failed. The F1 spec was updated for the new C_ADMIN hub heading and nav.

**Re-run against backend `main`** (`676ea65`, 2026-10-14; `git diff 389d70e 676ea65` is empty, so
the running backend is `main`'s code): `npm run test:e2e` → 31 passed, 19 skipped by design, 0
failed.

**Notes:**
- Each run leaves an `F2…` college, its users and a registered `f2.solo.*` account in the dev DB.
- `PW_CHROMIUM_PATH` must point at the installed `chromium_headless_shell-1243`; the Playwright
  package now expects revision 1248.
- Deviations: the import page's template links are plain `download` links (the files are
  static); the professor picker shows at most 50 results with a "search to narrow" line.
- Not migrated yet: other mutations in F1 screens (rename a college, add an act) don't invalidate
  the cached lists; the lists refetch on mount anyway (`staleTime: 0`).
- `CLAUDE.md` (untracked) still describes the pre-F0 state under "Current state".

### 2026-10-14 — F1 Identity, roles, SUPERADMIN & content admin (F1.1–F1.11)

**Status:** Done 2026-10-14. Backend `feature/phase1` was merged to `main` (`ca7c842`, same code as
`ddac579`), and `npm run test:e2e` was re-run against `main` (see below). Branch
`feature/f1-identity`, PR #3 (stacked on #2, F0). Lint (one pre-existing warning), `tsc -b`, the
build and 113 unit tests pass; CI passed on both PRs.

What changed:
- **F1.1 Login:** Email and College tabs (`role="tablist"`, arrow keys). College mode upper-cases
  the code as typed and trims the ID; exactly one request shape is sent. 401 copy per tab,
  `COLLEGE_INACTIVE` banner, `RATE_LIMITED` copy. Only the tab name is kept in `localStorage`
  (`lexly.loginTab`). The login screen now also shows why a session ended ("Your session has
  ended…" / college inactive), once; `describeAuthError` branches on codes, not HTTP statuses.
- **F1.4 Role homes:** `/admin` hub (Colleges, Content, Audit log cards); `/college`,
  `/professor`, `/student` placeholders. Nav: SUPERADMIN Colleges · Content · Audit · Library;
  C_ADMIN Audit · Library. Content goes to `/admin/acts`.
- **F1.5 Profile:** fresh `GET /users/me`: name, email, role label, college, and roll no. /
  employee ID by role. The error state keeps the session's email.
- **F1.6 Colleges:** `/admin/colleges` (debounced search, status, sort and page in the URL; table
  from 768px, cards below; "None" admins in the warning colour). Add college dialog → detail.
  Detail: code chip, status, stat tiles, rename, (de)activate with the spec's confirm copy, an
  audit-log link, and the Admins tab: add admin, reset password (both with **Generate** and a
  one-time share step with Copy details), remove (with the only-admin warning).
- **F1.7 Acts & sections:** `/admin/acts` (client filter, row menu, add/edit dialog that loads
  `GET /admin/acts/{id}`, typed-confirm delete), `/admin/acts/:actId` (server-ordered sections, add
  section → editor), `/admin/sections/:sectionId` (every reader field, nested exception
  illustrations, sticky "On this form" index with error counts, error summary, one full-replace
  `PUT` with `displayOrder` = position, unsaved-changes guard, reader-cache refresh after saves).
- **F1.8 Linking:** the Linked sections card on the case-law form with a picker dialog (act →
  filter → Link); Unlink at once with a toast.
- **F1.9 Import:** `/admin/import` (kind in the URL, paste or 1 MB `.json` file, an "Insert an
  example" button, client envelope checks), `ImportResultTable` (status chips, Rejected + Failed
  first, links for created rows), "Download rejected rows", unknown-act note, 400 banner.
- **F1.10 Audit:** one page for `/admin/audit` (college filter) and `/college/audit` (no
  `collegeId` sent). Action and date filters (last 7 days by default; `to` sent as the start of
  the next local day). Table from 1024px, cards below; rows expand to `details` as text.
- **F1.11 Tests:** unit tests for import parsing and the rejected-rows file, the section editor
  round trip (load → save unchanged → identical body) and nested error paths, audit summaries,
  college mapping and the password generator; route tests for both login modes, end-reason
  banners, role guards and the import page. E2E: `f1-identity.spec.ts` (desktop golden path) and
  `f1-phone.spec.ts` (work areas at 390 px).
- **Shared:** `Dialog`, `TypedConfirmDialog`, `RowMenu`, `StatusBadge`, `Pagination`,
  `EmptyState`, `ImportResultTable`, `useMediaQuery` (one DOM copy: table or cards),
  `lib/format.ts` (UI spec §0.4), `ContentSubNav` on every content page. `remapListErrors` now
  works for nested lists.
- **Accessibility fix:** axe flagged the gold `.eyebrow` text (about 2.9:1). Added
  `--lx-gold-ink` (about 5.6:1) and used it there.

**Verified against the live backend** (`lexly-backend` `feature/phase1` at `ddac579`):
`npm run test:e2e` → 24 passed, 10 skipped by design (the golden path runs on desktop only, the
phone pass on phone only, and the desktop forced-change check skips after the phone run has done
the change). The golden path covers the plan's "Done when": the seeded SUPERADMIN is forced to
change its password; adds a college (a duplicate code → `COLLEGE_CODE_ALREADY_EXISTS` on the
field) and a C_ADMIN, whose temporary password is shown once; the C_ADMIN is forced to change
theirs, lands on `/college`, sees their college's audit entries and can't open `/admin`; a bad
college login gets the generic message; the SUPERADMIN adds an act and a section, edits it
(client validation first, then save; a reload loads what was saved), and the reader shows the
edit; a sections batch with 3 bad rows gives "2 created · 3 rejected · 0 failed, out of 5", and
the downloaded file holds exactly those 3 rows; a section is linked to and unlinked from a case
law; the audit log shows `COLLEGE_CREATED` and `CONTENT_IMPORT` with details; deactivating the
college blocks its admin's sign-in with the inactive banner. axe runs on every screen, with no
sideways scroll at 390 px.

**Re-run against backend `main`** (`ca7c842`, 2026-10-14): backend restarted from `main` (Flyway: schema
up to date), the seeded SUPERADMIN restored to the seed state first (it had been changed since the
last run), then `npm run test:e2e`: 24 passed, 10 skipped by design, 0 failed. The seed was restored
again afterwards.

**Notes:**
- **The F1 e2e changes the seeded SUPERADMIN's password** (to `SUPERADMIN.newPassword` in
  `e2e/support.ts`). After this run I restored the local dev DB to the documented seed
  (`superadmin@lexly.local` / `lexly-superadmin-dev`, `must_change_password = true`, its refresh
  tokens deleted) with an `UPDATE` in the Docker Postgres, using the hash from the backend `.env`.
  Do the same before re-running if the forced-change checks should run again.
- Each e2e run leaves an `E2E…` college (deactivated), an act, a case law and a few accounts in
  the dev DB.
- Deviations from the UI spec: the audit College filter is a native `<select>` (browser
  type-ahead, the first 100 colleges by name), not a custom searchable select. Deleting an act
  that has no short code uses a plain confirm (there is nothing to type). The import page has an
  extra "Insert an example" button.
- Follow-up: other small gold text (`--lx-gold`) in the Library pages (`Browse.module.css`,
  `SectionDetail.module.css`, `CaseLawDetail.module.css`) wasn't checked here; it probably has the
  same contrast issue.
- `CLAUDE.md` (untracked) still describes the pre-F0 state under "Current state".

### 2026-10-14 — F0 Clean-up & foundations (F0.1–F0.7), with F1.2 pulled in

**Status:** F0 Done (backend P0 is merged). F1.2 is Done too: backend Phase 1 was merged to `main`
(`ca7c842`) and the e2e suite passed against it (see the F1 entry). Branch `feature/f0-cleanup`,
PR #2; CI passed. Locally lint, `tsc -b`, the build and all 72 unit tests pass.

What changed (one commit per task; see the commit bodies for detail):
- **F0.1** (`831bc7c`): MCQ practice removed: the Practice Progress card, the `practiceStats` flag,
  its DTOs, mapper and mocks. `/practice` is the "Solo practice is coming soon" placeholder. The
  Bare-Act Progress and Continue Learning cards are hidden while their flags are off (D3).
- **F0.4** (`e5af6e3`): `ConfirmDialog`, `Toast`, `Field`, `RepeatableList` and
  `useUnsavedChangesGuard` moved to `src/components/`, with `Admin.module.css` as
  `components/ui.module.css`.
- **F0.5** (`6e0f896`): `FormData` bodies, `patch`, `upload` (XHR with progress) and `download`
  (blob + `Content-Disposition` filename), `AbortSignal`, and the `errors.ts` catalogue.
- **F0.2, F0.3, F1.2** (`2c60601`, `768ef83`): the session user comes from `GET /users/me` after
  every sign-in (`roleFromAccessToken` is gone); `roles.ts`, `RequireRole`, role nav, NotFound,
  lazy admin chunk, Library sub-nav; `/change-password` forced and voluntary; a
  `403 PASSWORD_CHANGE_REQUIRED` from any call switches to forced mode; post-navigation toasts
  come from a flash store; the refresh call uses `keepalive` (G10).
- **F0.6** (`f63ff60`): Vitest + Testing Library + MSW (72 tests), Playwright + axe golden paths
  at 390×844 and 1280×800, and a CI workflow (lint, `tsc -b`, tests, build).
- **F0.7** (this entry's commit): `e2e/f0-cookie-session.spec.ts` turns the 2026-10-09 cookie
  checks into a committed suite and runs them against the live backend.

**Verified against the live backend** (`lexly-backend` `feature/phase1` at `ddac579`, Postgres +
Redis in Docker), `npm run test:e2e` with an installed Chromium (`PW_CHROMIUM_PATH`): 16/16 pass on
phone and desktop.
- The refresh cookie is `HttpOnly`, `Path=/api/v1/auth`, `SameSite=Lax`; JS can't read it, and Web
  Storage holds no token. A reload keeps the session.
- Two tabs reloading together, three rounds: both stay signed in (the Web Lock serialises the
  rotations).
- G10: starting a load and navigating away before the bootstrap refresh settles, three rounds:
  still signed in. The `keepalive` fix holds, so no retry-after-rotation was needed.
- Logout: `204`, the cookie is cleared, the 5-minute cache-bypass timestamp is set, and the next
  load goes to `/login` with no "session ended" banner.
- On the wire: `/auth/refresh` without a token → `400`; replaying a rotated token → `401
  UNAUTHORIZED`; `GET /acts` → `private, max-age=300` + `ETag`; `GET /users/me` → `no-store`;
  the preflight from `http://localhost:5173` allows credentials.
- F0 golden paths (`f0-session.spec.ts`): NotFound signed out; the seeded SUPERADMIN is held on
  the forced change and a wrong current password maps to its field; a new S_STUDENT gets the
  student nav, is kept out of `/admin`, and survives a reload. axe finds no WCAG A/AA violations
  on those screens.

### 2026-10-13 — Docs: synced with backend Phase 0 and Phase 1

**Status:** Done (docs only). No app behaviour changed.

**Source:** `lexly-backend` Phase 0 (`0545ab9`, merged to `main` as PR #2) and Phase 1 (`ddac579`
on `feature/phase1`, not merged yet). I read the commits, the DTOs and controllers, and the
backend's contract copy.

- **Contract:** `docs/Lexly-API-Contract.md` re-copied from the backend's
  `Lexly-API-Contract_backend.md` at `ddac579`. P0 and P1 sections are now LIVE: per-row bulk
  import, `page`/`size` validation, both login modes, `role` + `mustChangePassword` in auth
  responses, change password and its gate, the extended `/users/me`, colleges and C_ADMINs,
  the audit log, and `GET /admin/acts/{id}` and `GET /admin/sections/{id}`. `RATE_LIMITED` moved
  to P8. `BULK_IMPORT_REJECTED` and `FOLLOWUP_LIMIT_REACHED` were removed.
- **Plan:** backend state in the header; G1/G9 note that the current UI breaks on a P1 backend;
  new G13 (old bulk shape, unused); F0.2/F0.3 drop the legacy role mapping; F1.1, F1.2, F1.7,
  F1.9 and F1.10 use the live behaviour; B1, B2 and B7 marked LIVE; §8 next steps rewritten (F1.2
  pulled into the F0 branch); the dev SUPERADMIN seed is noted under F1.
- **UI spec:** no legacy mapping; change-password server messages mapped to copy; bulk-import
  `400` cases and the unknown-act case; audit summaries rewritten to the `details` the backend
  actually records (for example `USER_CREATED` has email and role, no name); U3 and U4 closed.
- **Status report:** F0 and F1 marked Ready; the P1 breakage called out.
- **Checked against the code, not only the contract:** `AuthResponse`, `LoginRequest`,
  `ChangePasswordRequest`/`Response`, `CurrentUserResponse`, `CollegeResponse`,
  `UpdateCollegeRequest` (`name` and `active` both required), `CreateCollegeRequest`,
  `CreateCollegeAdminRequest`, `UserSummary`, `AuditEventResponse` and `BulkImportResult` match
  the contract. Routes: `/superadmin/colleges/**` and `/superadmin/admins/**` (SUPERADMIN),
  `/audit` (SUPERADMIN, C_ADMIN), `/admin/**` (SUPERADMIN).
- **Not verified live:** a local backend was answering on :8080, but I didn't check which branch
  it runs, and I made no calls against it.

### 2026-10-13 — Docs: frontend plan, UI spec, status report and API contract in sync

**Status:** Done (docs only). Lint passes. No app behaviour changed.

- **Added**
  - `docs/Lexly-API-Contract.md`: copy of the backend repo's contract, which is the master.
    Re-copy it when it changes.
  - `docs/Lexly-Frontend-Implementation-Plan.md`: the phase plan F0–F8.
  - `docs/Lexly-UI-Spec.md`: layout, data, states and copy per screen. F0 and F1 are written;
    F2–F8 are stubs, each written before its phase starts.
  - `docs/Lexly-Frontend-Status-Report.md`: what is built against the plan, task by task.
- **Plan updated from the contract**
  - Backend asks B1–B8 now have a Status column (B1 is a nested `college` object in `/users/me`).
  - Three `*_ALREADY_EXISTS` codes added to the error catalogue.
  - F3–F7 use `serverTime`, `uploadLimits`, `history`, `generatedAt` and `resetsAt`.
  - F1.7: the section editor saves with one full-replace `PUT`.
- **Removed**
  - `docs/HOME_DASHBOARD_API_CONTRACT.md`, superseded by the contract (its §15 lists the
    dropped endpoints).
  - The duplicate `Lexly-API-Contract_backend.md`.
- **Comments:** the code comments and `.env.example` that cited the old Home contract now point
  at `Lexly-API-Contract.md` §15.
- **Next Up:** rewritten from the plan.

### 2026-10-11 — Dev: API data no longer stale for up to 5 minutes

The backend sends `Cache-Control: max-age=300, private` on content GETs, so after a backend
change (a restart, a content edit, a contract change) the browser kept showing the previous
response for up to 5 minutes. In development, `api/client.ts` now sends every GET with
`cache: 'no-cache'` (`getCacheMode()`): the browser revalidates each time, which costs a 304 via the
ETag when nothing changed. Production builds keep the browser cache, and the after-logout
`reload` bypass is unchanged. Verified in Chrome: content changed through the API showed on the
next in-app visit to the page.

Seen while testing, not changed: navigating away while `/auth/refresh` is still in flight can sign
the user out. The server has already rotated the token, but the aborted response never delivers
the new cookie. Only reproducible with two page loads in very quick succession.

### 2026-10-11 — Free/Pro removed (for now)

**Status:** Done. Lint, `tsc -b` and the build pass. Checked in headless Chrome against the live
backend, which no longer sends `isFree`, returns no `PRO_REQUIRED` teasers and has no
`PUT /admin/caselaws/{id}/free-flag`.

What changed:
- **API:** `isFree` removed from `SectionSummary`, `SectionDetail`, `CaseLawSummary`,
  `RelatedSection`, `SearchResult` and the admin case law request/response. `getSection` /
  `getCaseLaw` now return the detail directly: the `SectionResult` / `CaseLawResult` "locked"
  unions and the teaser types are gone, so any 403 is a normal error. `ApiError.body` (only used
  for teasers) and `setCaseLawFree` are removed.
- **Screens:** `ProBadge` is deleted, along with the lock icons in the act list, pager and
  "Sections interpreted", the "locked" item styling, and the locked teaser views on both detail
  pages. Also removed: the Pro marks in search, case law list and universal search. The
  "Sections marked Pro…" note on an act's sections became a plain subtitle, which keeps the
  spacing under the title (same pattern as the Acts page).
- **Section page:** Previous / Next now always come from the section response. The fallback that
  used the act's list for a locked section, and the pager under the error state, are gone.
- **Admin:**
  - The list loses its Free/Pro tag and Make free / Make Pro button.
  - The details form loses the "Free for all students" checkbox; its group is now "Importance
    and source".
  - The content editor always fetches the case. The "start empty after create" hand-off existed
    only because of Pro gating and is gone; the hand-off now carries just the toast message.
- **Dead CSS removed:** `.badge`, `.lockIcon`, `.itemLocked`, `.locked*`, `.hitHeading` and
  `.checkbox`. Also the leftovers from the old case and section layouts: `.caseMeta`,
  `.externalLink`, `.entries`, `.entry*` and `.bodyText`.
- **Docs:** `HOME_DASHBOARD_API_CONTRACT.md` has a note that free/Pro is suspended and its
  `isFree`/Pro parts are out of scope until it returns. The master doc in the backend repo is
  untouched, since the backend team is changing that contract.
- **To bring Pro back:** restore from git history (this entry's diff). The study-panel layout
  doesn't depend on it.

### 2026-10-10 — Case law detail: Bare Acts study-panel design

**Status:** Done. Lint, `tsc -b` and the build pass. Checked in headless Chrome against the live
backend at 1440, 1100 and 390px; no horizontal scroll on phones. The section screen was
pixel-compared before and after the refactor at all three widths and is unchanged.

- **Shared study panel.** The section screen's reusable parts were moved out of
  `SectionDetailPage.tsx` with no change in behaviour:
  - **`StudyPanel.tsx`:** `ReadingProgress`, `OnThisPage`, `Insights`, `DocPart`, `RichText`.
  - **`studyPanelModel.ts`:** `usePartNavigation` (scroll spy + jump), `StudyPart`, text helpers.
  - **`StudyPanel.module.css`:** panel frame, side columns, chips, insights, parts and breadcrumb.
  - **`SectionDetail.module.css`** keeps only the section's own parts: act list, statute text,
    term popovers, clauses, illustrations, exceptions and pager.
  - Each page passes a tone class per part. The tone defines `--tone` and `--tone-soft`.
- **`CaseLawDetailPage` uses the same panel** (wide 72rem layout, like `/sections/*`):
  - **Left rail:** reading progress, scroll-tracked "On this page", and "Sections interpreted"
    (in place of "In this Act").
  - **Centre:** a serif document. Meta line (case type · year, importance, Pro), title, lede, then
    a case-facts card. The card's labels sit above their values in two columns from 768px.
  - **Parts, each with its own tone:** Background, Issues, Arguments, Final Holding (callout with
    outcome badge), Ratio (solid "Binding"), Obiter (dashed "Not binding", italic), Provisions,
    Principles, Related Sections. Issues are collapsible from 3 issues on. Arguments are party
    cards.
  - **Right rail:** reading time, decided date and issue count, plus insight cards that jump to
    each part.
  - **Below 1024 / 1200px:** sticky chip bar and inline insights, as on the section screen.
  - **Breadcrumb:** "Case Laws / {citation}". "Case Laws" returns to the filtered list the reader
    came from.
- **Backend drift found while testing:** the local backend's uncommitted work removes the
  free/Pro model (`isFree`, the 403 teasers, `PUT …/free-flag`). Not migrated here. Until then,
  every case and section shows a "Pro" badge (missing `isFree` reads as not free), and the admin
  list's Make free / Make Pro button gets a 404.

### 2026-10-10 — Case Law — Structured Content Migration

**Status:** Done. Lint, `tsc -b` and the build pass. Verified with headless Chrome (Playwright,
56 checks) against the dev server and the **live** local backend. The checks used a test admin
and a test student account, and seeded case `22222222-2222-4222-8222-000000000006`.

The backend replaced the free-text case summary (facts/issues/held/analysis) with structured
content. Everything that used `summary`, `/summary` or `SUMMARY_ALREADY_EXISTS` was migrated or removed.

**Read side**
- **`api/caselaws.ts`:** `CaseLawDetail` now has `caseNumber`, `bench`, `judges`,
  `jurisdiction`, `caseType`, `onlineSummary`, `background`, `issues[]`, `arguments` (keyed by
  party), `finalHolding`, `ratioDecidendi[]`, `obiterDicta[]`, `importantProvisions[]` and
  `legalPrinciples[]`. `CaseSummaryText` is gone. `toCaseLawDetail` turns blank strings into
  `null` and drops blank entries and empty party lists, so no empty heading can render. List and
  detail fetches accept `RequestOptions`, so admin screens can bypass the 5-minute browser cache.
- **`pages/content/caseLawLabels.ts`** is the one shared util for code-like values:
  `humanizeCode` turns `SIR_UPHELD_WITH_DIRECTIONS` into "Sir upheld with directions" and passes
  plain text through. `caseTypeLabel` has a label map (`WRIT_PETITION` → "Writ Petition"), and
  `partyLabel` maps the six parties (AMICUS → "Amicus Curiae") and title-cases unknown keys.
- **`CaseLawDetailPage`** (+ new `CaseLawDetail.module.css`):
  - **Header:** title, importance badge, `onlineSummary` lede, and a metadata `<dl>` that skips
    null rows.
  - **On this page:** jump links for the sections present. They scroll in place, move focus and
    leave the URL hash alone.
  - **Sections, in order:** Background → Issues → Arguments → Final Holding → Ratio → Obiter →
    Provisions → Principles → Related Sections. Empty sections are left out.
  - **Issues** are numbered. From 3 issues on, each one is a `<details>` and the first starts open.
  - **Arguments** keep the order of the keys as they arrive. Two columns from 720px.
  - **Outcome** is a text badge.
  - **Ratio** has a solid "Binding" tag and a solid rule. **Obiter** has a dashed "Not binding"
    tag and italic text.
  - **Provisions** are plain text, not links.
  - **Principles** are a `<dl>` of cards.
  - The locked teaser is unchanged and renders no structured content.
  - Removed `.summaryBlock` from `Content.module.css`.
- **`CaseLawsPage`:** help text "Search by case name, citation, court, case number or judge",
  linked with `aria-describedby`, plus a new placeholder. Filters are now top-aligned.

**Admin side** (new: the Prompt 3/5 admin screens had never been built, so the case law part was
built here)
- **Role:** `SessionUser.role` comes from the JWT `role` claim at login/register and from
  `GET /users/me` on reload. `RequireAdmin` sends anyone who isn't an admin to `/dashboard`. The
  server still enforces the role; a stale role just gets the server's 403 shown as an error.
  The only entry point is an "Admin: manage case laws" link on Profile, shown to admins only.
- **Routing:** `main.tsx` now uses `createBrowserRouter` with a single splat route around `App`,
  so `useBlocker` works. `App`'s `<Routes>` are unchanged. `/admin/*` uses the wide layout.
- **`api/adminCaseLaws.ts`:** create/update/delete/free-flag and `PUT .../content`. Types
  `CaseLawMetadataRequest`, `CaseLawAdmin` and `CaseLawContentRequest`, plus `CASE_LAW_LIMITS` /
  `CONTENT_LIMITS` mirroring the server's `@Size` limits. `apiClient.delete` added.
- **`/admin/caselaws`:** search, pagination, Details / Content links, a Make free / Make Pro quick
  action, and Delete. The delete confirmation (native `<dialog>`) says it also deletes all
  issues, arguments, holdings, other content and section links.
- **`/admin/caselaws/new` and `/:id`:** metadata form with every new field. Client limits match
  the server (citation is now 500). Case type suggests known codes and previews how it will
  display. Linked sections are shown read-only. After a create, the app opens the content editor.
- **`/admin/caselaws/:id/content`:** the content editor.
  - **Loading:** reads `GET /caselaws/{id}` and flattens `arguments` into rows.
  - **Lists** (`RepeatableList`): Add / Move up / Move down / Remove on every row. Row numbers
    follow position live. Focus follows the moved row, and a polite live region announces moves.
  - **Saving:** the whole body goes to `PUT .../content` and the form refreshes from the response.
    Sequence fields are never sent.
  - **Change tracking:** "dirty" means the request body differs from the loaded one. That drives
    the single Save button and the unsaved-changes guard (in-app navigation via `useBlocker`,
    plus `beforeunload`).
  - **Feedback:** a saving state and a success toast.
  - **Validation:** client checks mirror the server. A 400 `VALIDATION_ERROR` message
    (`path: msg, path: msg`, or "… at path") is parsed into inline row errors and an error
    summary with links. Errors follow their rows when rows move.
  - **Round trip:** the seeded case saves back byte-identical, checked by comparing JSON after a
    reorder, save, restore and save.

Notes / backend gaps:
- **`GET /caselaws/{id}` gates by subscription, not role.** A non-Pro admin gets the 403 teaser
  for Pro cases, and there is no admin read endpoint, so the editors can't load them. The editors
  explain this and refuse to show an empty form, because a full-replace save from it would wipe
  the content. Workarounds: make the case free from the list, or use an admin with Pro.
  Suggested backend fix: treat `ADMIN` as entitled in `CaseLawService`.
- Straight after "Create case law", the editor starts empty from the create response, because a
  new case has no content. That hand-off is read once and cleared from history, so a reload
  fetches again.
- Section linking UI (Prompt 5, unchanged endpoints) is not built yet; linked sections are listed
  read-only.
- After a save the admin refetches the public detail with `cache: 'reload'`, so the
  student-facing page in the same browser isn't served the old cached copy.

Files touched: `src/main.tsx`, `src/App.tsx`, `src/api/{caselaws,adminCaseLaws,auth,client}.ts`,
`src/auth/{session-store.ts,AuthContext.tsx,RequireAdmin.tsx}`, `src/components/AppLayout.tsx`,
`src/pages/ProfilePage.tsx`,
`src/pages/content/{CaseLawDetailPage.tsx,CaseLawDetail.module.css,CaseLawsPage.tsx,Content.module.css,caseLawLabels.ts}`,
`src/pages/admin/*` (new: list, metadata form, content editor, `RepeatableList`, `Field`,
`ConfirmDialog`, `Toast`, `useUnsavedChangesGuard`, `contentForm.ts`, `adminCaseLaw.ts`,
`Admin.module.css`). Docs: `Lexly-Frontend-Development-Master-Doc.md` (backend repo; copy mirrored
to `lexly-web/design/`): module summary, error codes, case law and admin endpoint tables, data
models, Prompts 4 and 5.

### 2026-10-09 — Backend integration: refresh cookie, `/users/me`, section neighbours

**Status:** Done in code; lint, `tsc -b` and the build pass. The **live** backend was not running,
so the browser checks ran against a local mock written to the backend's integration note (cookie
rotation, 400/401 refresh, 204 logout, `Cache-Control`/`ETag`, CORS with credentials). Re-run them
against the real backend before merging it.

What changed:
- **Session survives a reload.** The refresh token is no longer held in JS at all: the backend sets
  it as an HttpOnly `lexly_refresh_token` cookie (`Path=/api/v1/auth`, `SameSite=Lax`), and
  `/auth/refresh` is called with no body. Only the access token is kept, in memory. `refreshToken` in
  response bodies is ignored.
- `credentials: 'include'` is sent on the **auth calls only** (register, login, refresh, logout).
  The cookie's path means other requests would carry nothing.
- **Bootstrap:** the session store starts in `loading`. `bootstrapSession()` (`api/auth.ts`, once
  per page load) calls `/auth/refresh`, then `GET /users/me` for the user (the refresh body has no
  user). 400/401 → `anonymous` with no error UI. `RequireAuth` and `RedirectIfAuthenticated` show
  a neutral `SessionPending` screen meanwhile, so neither `/login` nor a protected page flashes.
- **One refresh at a time:** `refreshSession()` shares one in-flight promise between the bootstrap,
  401 retries and StrictMode's doubled effects. It also runs under a Web Lock
  (`navigator.locks`, `lexly-auth-refresh`), so two tabs reloading together refresh one after the
  other, and the second sends the cookie the first just rotated. Without the lock, the mock showed one
  of the two tabs getting logged out. A 401 for a token that has already been replaced retries
  without another refresh.
- **Logout:** `POST /auth/logout` with credentials, then `sessionStore.clear()`, even if the request fails.
- **HTTP cache after a user change** (option (b)): content GETs are now browser-cached for 5 minutes,
  keyed by URL. After a logout or an expired session, every GET uses `cache: 'reload'` for 5 minutes
  (a timestamp in localStorage, so it survives reloads and applies to all tabs). The next user
  never sees the previous user's cached Pro section.
- **`VITE_API_USERS_ME=true`** in `.env.example` and the local `.env`. Search, practice stats and
  learning progress flags stay `false`.
- **Section detail:** `actId`, `actTitle`, `prev`, `next` are mapped onto `SectionDetail`, and
  `isFree`/`actId`/`actTitle` onto the locked teaser. The page builds the breadcrumb
  (Bare Acts / {act} / Section n), the act sidebar and Previous / Next from the response, however it
  was opened. Router `state` is now only an optional "Back to search results" hint. Locked
  neighbours stay linked with the lock + "(Pro)". The locked teaser names its act and links back to
  it. Its Previous / Next come from the act's section list, because the 403 body has no neighbours.
- **Sort:** `compareSectionNumbers` (numeric `Intl.Collator`) matches the backend's natural order:
  19 < 19A < 19AA < 19B < 20, and sections with no number last. The sort is kept as a safety net.
- No code treated a 500 as "endpoint not deployed" (the flags gate those calls), so the change of
  unknown routes to 404 needed nothing here.

### 2026-10-08 — Bare Acts section screen: study content

**Status:** Done. Verified with headless Chrome against the dev server and the **live** local
backend. Section 2 of the Contract Act has every field filled, and Section 10 has only the bare
text.

What changed:
- **`api/content.ts`:** `GET /sections/{id}` now maps the enriched response: `inSimpleWords`,
  `provisionMeaning[]` (`clause`, `title`, `explanation`), `illustrations[]` (`text`,
  `hypothetical`), `exceptions[]` (`title`, `explanation`, nested `illustrations[]`) and
  `keyLegalTerms[]` (`term`, `definition`). `toSectionDetail` normalizes the response: a missing or
  null list becomes `[]`, a blank summary becomes `null`, and `id` falls back to the route id.
- **Layout (redesigned the same day as a study panel, modelled on a writing-app reference):** the
  page uses the shell's wide 72rem layout (`AppLayout` treats `/sections/*` as wide) and renders
  one white panel with three columns:
  - **Left (≥1024px):** reading progress, "On this page" (scroll-spy) and "In this Act". That list
    is every section of the act, from `GET /acts/{actId}/sections`, with the current one marked.
    The act id is parsed from the `backTo` router state (`/acts/{id}`). Switching sections there
    keeps the back link and scrolls to the top.
  - **Centre:** the section as a serif document in **Source Serif 4**, self-hosted via
    `@fontsource-variable/source-serif-4` with no Google Fonts request, and the reading line is
    about 60–70 characters. A **Read / Study** toggle: Study highlights the first mention of each
    key legal term in the Act text. A focusable `<mark>` shows its definition in a popover on
    hover, focus or tap, and Escape closes it. The popover stays inside the viewport and opens
    upward near the bottom of the screen.
  - **Right (≥1200px):** stats (reading time, words in the Act, clauses) and colour-coded insight
    cards. Each card jumps to its part.
  - Below those widths the insights sit above the text (a swipeable card row on phones), and the
    "On this page" links become a sticky chip bar.
  - Each kind of content keeps one colour everywhere: key terms amber, clauses violet,
    illustrations blue, exceptions red, summary green. Solid swatches use dark shades so white
    text stays ≥ 4.5:1.
  - The loading, error and locked states keep the 48rem column.
- **`SectionDetailPage`:** the "On this page" links scroll in place and don't touch the hash,
  which keeps the "Back to …" router state. The page shows Lexly cards in this order:
  Bare Act text (clause labels such as "(a)" in a hanging gutter), In simple words (a gold card),
  Clause by clause, Illustrations, Exceptions (with nested illustrations) and Key legal terms (a
  two-column grid from 768px).
- Each illustration is tagged **Hypothetical** (written by Lexly) or **From the Act**, so students
  can tell the two apart. In explanations, "• " lines render as lists and short labels such as
  "Promisor:" are bold.
- The new styles are in `SectionDetail.module.css`, which uses the `--lx-*` tokens. The locked (Pro)
  view is unchanged.

- **Section order:** `GET /acts/{id}/sections` returns sections sorted as strings (1, 10, 100, 11,
  …, 2, 20, …). `listSections` now sorts them by section number in natural order (1, 2, …, 19,
  19A, 20, …, 100; sections without a number go last), using `Intl.Collator` with
  `numeric: true`. This applies to both the act's section list and the "In this Act" sidebar.
  The proper fix is ordering in the backend query; the frontend sort can stay as a safety net.

- **Previous / Next section:** a pager at the end of every section shows "N of M sections in this
  Act" and links to the neighbours in natural order (§19 → §19A → §20). Locked sections still
  show the pager under the Pro teaser, so reading in order never dead-ends. The act's ordered
  list is fetched once at page level and shared with the "In this Act" sidebar; switching
  sections no longer re-fetches it. While the next section loads, the current one stays on
  screen dimmed (`aria-busy`) instead of flashing a loading state. Like the sidebar, the pager
  needs the act context from `backTo` (it's hidden for sections opened from search).
- **Backend performance (measured 2026-10-08 against the local backend):** every response is
  sent uncompressed with `Cache-Control: no-store` and no `ETag`. The CORS preflight has no
  `Access-Control-Max-Age`, so authenticated GETs keep paying an extra OPTIONS round trip.
  Section detail takes ~80 ms against ~40 ms for the list endpoints. The list (101 sections) is
  15 KB uncompressed. See the recommendations given to the backend.

Notes:
- The live detail response doesn't include `isFree`. The page treats it as free and only shows
  the Pro badge when `isFree` is `false`.

### 2026-10-06 — Dashboard as hub: post-login routing & simplified header

**Status:** Done. Verified with headless Chrome (CDP) against the dev server and the **live**
local backend. The login response was rewritten only to simulate a backend that returns
`firstName`.

What changed:
- **Routing:** the new `RedirectIfAuthenticated` guard wraps `/login` and `/register`. A signed-in
  user is sent to `/dashboard`, both on opening those routes (and `/` or `*`, which go via
  `/login`) and the moment login or registration succeeds. The pages no longer navigate
  themselves. Login therefore always lands on the Dashboard: the `state.from` return-to-page was
  dropped, and `RequireAuth` no longer sets it.
- **Header:** the Home / Subjects / Practice links were removed. It now shows the brand (a `Link`
  to `/dashboard`, `aria-label="Go to dashboard"`), then `Hi {fullName}!`, the bell and the avatar.
  A long name truncates with an ellipsis and the full name is in a `title` tooltip. Below 360px,
  or when there is no name, it reads "Hi!".
- **Name source:** `/auth/login` and `/auth/register` now return `fullName`, stored on the session
  user. `AppLayout` resolves the name once: `/users/me` takes priority when it exists, otherwise
  the auth response is used. The Home hero keeps its first-name greeting (`firstNameFrom`, which
  takes the first word of `fullName`) through the outlet context (`useAppLayout`), so Home no
  longer calls `/users/me` itself. The name is never derived from the email.
- **Mobile tab bar** is kept, with "Subjects" renamed to "Bare Acts" to match the Dashboard.

Notes:
- `GET /users/me` still returns 500 (not implemented), so the name currently comes only from the
  login/register response. Because the session lives in memory, the name, like the session, is gone
  after a page reload.
- Throwaway account `lexly.navtest.<timestamp>@example.com` was registered on the local backend.

### 2026-10-06 — Login & Register redesign

**Status:** Done. Verified with headless Chrome (Playwright) against the dev server and the
**live** local backend, with no mocks except the network-failure and bare-401 cases.

What changed (frontend only — `api/auth.ts`, `AuthContext`, `session-store`, `RequireAuth` and
`validation.ts` are untouched):
- **`AuthLayout`**: a light ivory brand panel (navy wordmark, brass accents), plus the form. Phones get a
  compact band with the wordmark and a cropped illustration of about 136px. The art is hidden when
  the viewport is under 560px tall (keyboard open). From 600px the band shows the hero copy and
  the form sits in a card. From 1024px the layout is a split screen with a sticky brand panel
  (56%). The page uses `min-height: 100dvh` and never a fixed height.
- **`AuthIllustration`**: an original inline SVG modelled on a supplied reference. A student at a
  desk (law-book stack, open book, laptop) sits inside a dashed orbit of vignettes: Bare Acts,
  court, advocate, scales, case law, graduation and practice. Both figures are faceless, with a
  short tousled haircut and neutral clothing, so the scene is gender neutral. Phones show only the
  student at the desk. It uses the Lexly palette only and is `aria-hidden`.
- **`AuthField` / `PasswordField`**: a label above each input, a 48px control, and the error or
  hint linked through `aria-describedby`. The show-password control is a 44px button with
  `aria-pressed`.
- **`authForm.ts`**: maps `ApiError`s to user-facing text, so the backend's `message` or HTTP status
  text is never shown raw. Focus moves to the first invalid field when a submit fails validation.
- Login copy is now "Welcome back" / "Sign In". The redirect is unchanged: `state.from`, else
  `/dashboard`. Register still signs the user in and goes to `/dashboard`.
- **Not added:** forgot password and remember me. No route or backend support exists, and the
  session lives in memory by design.

Verified: `tsc -b` + `vite build` clean, `oxlint` shows only the pre-existing `AuthContext.tsx`
warning. Tested flows: login ↔ register links, password toggle, wrong password, Enter to submit,
a double-click sending one request, register leading to `/dashboard`, duplicate email (409) with
a "Sign in instead" link, anonymous `/acts` → login → back to `/acts`, login leading to
`/dashboard`, network failure, and a bare 401. Nothing is written to Web Storage. There is no
horizontal overflow at 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900 or
390×450 (simulated keyboard).

Notes:
- The backend CORS config allows only `http://localhost:5173`. Running the dev server on any
  other port makes every auth call fail, which shows as "Unable to connect".
- Throwaway accounts `webui-auth-redesign-<timestamp>@example.com` were registered on the local
  backend during testing.

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
- **No persistence across reloads.** _Resolved 2026-10-09: the backend now sets the refresh token
  as an HttpOnly cookie and the app restores the session on load. See that entry._ Per the prompt's instruction not to default to
  localStorage/sessionStorage for the refresh token either, both tokens live only in
  `session-store.ts`'s module memory — a full page reload always logs the user out. Flagging
  this explicitly as the deferred decision the prompt asked for, rather than picking a storage
  mechanism unasked. Options for a follow-up: an httpOnly cookie set by the backend (best, but
  needs backend support), or an in-memory refresh with a backend-driven "remember me" opt-in.

## In Progress

### 2026-10-22 — UR: code review fixes before merging to `master`

**Status:** Done (`96e2f5e`). `tsc -b`, the build, lint (one pre-existing warning) and 262 unit
tests pass. Not re-checked in the browser against the live backend.

What changed (from a review of `master...feature/ui-refresh`):
- A `Placard` whose query failed is no longer a link, so its Try again button doesn't sit inside
  an `<a>` and doesn't navigate away when clicked.
- While the password must be changed (so there is no sidebar), the top-bar brand also shows from 768 px.
- My studies: an open assessment with no due date shows "No due date" in the Due next hero instead of "Due —".
- SUPERADMIN Overview: the colleges table caption says "first 3", which matches the rows it shows.
- The sidebar toggle writes `localStorage` outside the state updater. `cardState`'s JSDoc now
  describes its real behaviour. The unused `ChatIcon` is removed.

Left as is: after a sign-out, `signedOut` also drops the return path for later deep links in the
same anonymous session (a deliberate trade-off of `5c5de4d`). The Study hub's Bare acts table
isn't `HomeTable` yet. The Overview makes two colleges requests.

### 2026-10-21 — UR brand: Lexly logo and the "Knowledge is power" motto

**Status:** Committed on `feature/ui-refresh` (`1864c62`) and merged to `master` on 2026-10-22. `tsc -b`, the build, lint (one
pre-existing warning) and 262 unit tests pass. Checked in the browser against the live local
backend: sign-in (1440 / 390 px), register (800 px), and the Study hub of a fresh S_STUDENT with
the sidebar collapsed, expanded and on a phone.

What changed:
- **Logo:** the master file is `docs/brand/lexly-logo.png`. `components/brand/Logo.tsx` draws it
  in code: `LexlyWordmark` (Manrope 800, tight tracking, the spark top right of the "y"),
  `LexlySpark` and `LexlyMark` (a white "L" and the spark on a black tile). New tokens
  `--lx-brand-black` (#0b0b0d) and `--lx-spark` (#9d8cff, decorative only). `LexlyMark` moved out
  of `Icons.tsx`.
- **Everywhere the "§" tile was:** sidebar (the mark when collapsed, the wordmark and college code
  when expanded), the phone top bar (the wordmark), the auth frame, the session splash. The
  favicon (it was still Vite's) is now the mark; `theme-color` is #0b0b0d, and there is a meta
  description.
- **Sign-in / register / change password (`AuthLayout`):** the hero is now the motto "Knowledge
  is *power.*", with the spark on the pill, shown at every width (on phones under the logo,
  without the tagline). The auth frame uses the brand black.
- **Brand pass 2 (same day):**
  - **The spark means AI.** Outside the logo it marks only the tutor: `SparkIcon` (an outline
    spark in the line-icon set) replaces `ChatIcon` in the nav, the tutor placards and the auth
    feature card. The tutor page eyebrow, the new-chat intro and a visible "Lexly tutor" label on
    every answer carry the spark (the label replaces the hidden "Tutor:" prefix). The tutor action
    cards on the Study hub, My studies and the SUPERADMIN Overview pass `ai` to `ActionCard`, which
    puts the spark on the pill's corner and in the button. The first pass's spark on the home
    greeting and the hero-card watermark were removed, because they weren't AI.
  - **The pulsing spark is the AI's working state.** It replaces the spinner on the tutor's
    "Answering…" line, and `LexlyMark pulse` animates the spark on the session splash. It is
    still under `prefers-reduced-motion`. The in-button spinners stay (they aren't AI).
  - **Legal maxims** (`components/brand/Maxim`, Latin marked `lang="la"`, in the serif): the 404
    has "Ignorantia juris non excusat", and the professor's grade form has "Audi alteram partem".
    `EmptyState` takes an optional `title`; the four truly empty assessment lists (the professor's
    Teaching desk and list, the student's My studies and list) open with "Nothing on the docket
    yet."
  - **Sidebar in the logo black:** `--lx-sidebar` is now #0b0b0d (the frame and the dark action
    cards follow).
  - Checked in the browser against the live backend: the Study hub, the tutor and the 404 for a
    fresh S_STUDENT. The "Answering…" state was not seen live (it would spend AI quota); a unit
    test covers its text.
- **Homes fit one screen (same day):** the home tables show 3 rows instead of 5 (SUPERADMIN
  colleges, C_ADMIN recent activity — now fetched with `size: 3` — the professor's and student's
  assessments, the Study hub's bare acts); "see all" links stay. The dark `ActionCard` (the tutor
  card, and the import / new-assessment cards that share it) is compact: no 15rem min-height,
  smaller padding and title, it no longer stretches to the table's height, max width 22rem.
  The black frame now fills the window: the shell margin round it is 0.5rem (was 1rem, 1.75rem
  from 1280 px), the frame padding 0.5rem, and the top bar and main padding are tighter. Home
  tables use `compactTable` (0.5rem row padding), the home's section gap is 1.1rem and the H1 is
  1.9rem from 768 px. The build, lint and 262 unit tests pass. Measured with a throwaway
  Playwright script against the live backend: none of the five homes (SUPERADMIN, C_ADMIN,
  professor, college student, S_STUDENT) scrolls at 1280×720, 1366×768, 1440×900 or 1920×1080.
  The professor and student homes had no assessments, so their tables were the empty state.
  From 768 px `.main` is a flex column that fills the panel, the home's `.page` grows into it, and
  the second row (`.row + .row`) has `margin-top: auto`, so the table and action card sit at the
  bottom of the screen. Checked in the browser: the homes still don't scroll, and
  `/admin/colleges` and `/tutor` look as before.

### 2026-10-20 — UR UI refresh: role homes, auth, screens, clean-up (UR.3–UR.6)

**Status:** Built on `feature/ui-refresh`, not committed yet. Lint (one pre-existing warning),
`tsc -b`, the build and 261 unit tests pass. **Verified against the live backend** (backend
`feature/phase5a`): e2e F0, F1, F2, F3 and F4 pass on desktop and phone (42 passed; the skips are
the suites' own desktop-only / phone-only splits). F5a not run (it would re-index and spend AI
quota). Axe finds no violations on ~40 screens across all five roles (sign-in, register, each home,
every list, detail, form, the grading review, results, the Library, tutor, tutor admin, profile,
change password, NotFound; phone and desktop).

What changed:
- **Role homes (UR.3):** shared `components/dashboard/` (`HeroCard`, `PlacardGroup` / `Placard`,
  `ActionCard`, `SegmentBar`, `Legend`, `Sparkline`, `HomeTable` (table from 768 px, cards
  below), `cardState`). SUPERADMIN **Overview** (`/admin`: AI spend + sparkline, active colleges,
  people across colleges, last index run, colleges table, Re-index card); C_ADMIN **Overview**
  (`/college`: people split, students / professors / subjects, last 7 days of audit, Import
  card); C_PROFESSOR **Teaching desk** (`/professor`: grading progress bars, answers to grade →
  first assessment with work, open assessments, next due, newest assessments, New assessment
  card); C_STUDENT **My studies** (`/student`: due next with answer progress, open assessments,
  results, tutor questions left, assessments, tutor card); S_STUDENT **Study hub** (`/dashboard`:
  universal search + act shortcuts, acts, case-law count, tutor questions left, acts table, tutor
  card; the flagged progress cards stay below). Each card loads and fails on its own. Only
  existing endpoints; `queryKeys.library.*` added.
- **Routes:** the lists moved to `/professor/assessments` and `/student/assessments` (breadcrumbs,
  redirects and nav follow); the professor and student tab bars gain their home ("Desk",
  "Studies").
- **Auth (UR.4):** `AuthLayout` rebuilt: black frame with the logo tile, the hero line with
  "Master it." in a pill and three pastel feature cards beside a white form panel; a black brand
  band on phones. Form fields, tabs (black pill) and buttons restyled; `AuthIllustration` removed.
- **Screens and clean-up (UR.4, UR.5):** the Library's per-content tones mapped to the pastels by
  family; titles and labels in sans, statute / case-law / rich text in the serif; ~250 hard-coded
  colours replaced with tokens (new `--lx-danger-*`, `--lx-sky-text`, `--lx-divider`); text that
  used the accent now uses `--lx-gold-ink` (axe caught 4.0:1 on the pager); links default to ink;
  tutor list on a grey panel and sources as pastel cards per type; `QuickActions` removed.
- **Tests (UR.6):** `pages/home/homes.test.tsx` (each home's numbers and links, one failing card
  doesn't blank the page), `test/homes.ts` (mocks for what each home loads), App / tutor tests
  for the new homes, list tests on the new routes. e2e: `logOut` clicks the profile page's own
  button (the sidebar has one too), tab-bar checks query the hidden bar from 768 px, lists
  opened explicitly after sign-in, exact `Search` / `College` labels (the top bar's search button
  and the profile pill now contain those words).

Notes:
- **Fixed 2026-10-20:** signing out on `/profile` used to leave `from: /profile` behind, so the next
  user on the tab landed on that page. A deliberate logout now sets `signedOut` in the session store
  (`sessionStore.signOut()`), and `RequireAuth` then sends the visitor to `/login` with no "return
  to" state; an expired session still returns the user to where they were. Test in
  `LoginPage.test.tsx` ("signing out").
- **Backend Phase 5a merged** to `lexly-backend` `main` on 2026-10-20 (PR #6, `f62b9f0`) after
  `./mvnw test` passed locally (263 tests, 0 failures; the backend repo has no CI). The frontend
  `master` no longer depends on unmerged backend code. Still owed for F5a: one Re-index and
  `e2e/f5a-tutor.spec.ts`.

### 2026-10-20 — UR UI refresh: foundations and shell (UR.1, UR.2)

**Status:** Built on `feature/ui-refresh` (cut from `master` after PR #6); superseded by the entry
above, which completes UR. Lint (one pre-existing
warning), `tsc -b`, the build and 255 unit tests pass. Checked in headless Chromium against the
live backend as SUPERADMIN (desktop collapsed and expanded, phone): axe finds no violations on
`/admin/colleges`, `/acts` and `/admin/tutor?tab=spend` (phone).

Decided by the user: the reference dashboard and the "Lexly UI refresh" design mock (approved);
Manrope for the interface with the serif kept for legal reading text (new dependency
`@fontsource-variable/manrope`, approved); bottom tabs on phones; **Overview** for SUPERADMIN and
C_ADMIN, with Teaching desk / My studies / Study hub proposed for the others; mock first. No
endpoint changes.

What changed:
- **Docs:** plan row and section UR; UI spec section UR (tokens, type, components, shell, the
  five role homes with their endpoints, restyle rules).
- **Tokens (`index.css`):** new palette on the existing names (navy → black, ivory → grey
  surface, gold → blue accent) plus page, sidebar, sky, lavender, mint, cream, CTA, divider,
  `--lx-sans`, `--lx-radius-sm`; `--lx-serif` is now Source Serif 4. Both fonts load from
  `main.tsx`.
- **Shared styles:** headings and numbers in Manrope 800; buttons, inputs, badges (pastel +
  ink), tables (no frame, light dividers), stat tiles, tabs (black indicator), dialogs, toasts,
  menus, link cards restyled; the Library and Home heroes turned light blue (the dark hero made
  the Library sub-nav unreadable once "navy" became black).
- **Shell (`AppLayout`):** from 768 px a black frame with a collapsible sidebar (`sidebarFor`:
  the role home first, then the nav; collapsed rail by default, the choice kept in
  `localStorage` `lexly.sidebar`) and a white panel with a top bar (college name, Library
  search, notifications, profile pill "Profile: {name}"); below 768 px a top bar and a floating
  black tab bar. `NavItem.exact` keeps a home item from lighting up on its sub-pages.
- **Tests:** sidebar and tab bar per role, toggle + persistence, `sidebarFor` and exact matching.

Notes:
- The Library reading pages (section, case law, study panel) still carry their own hard-coded
  colours and serif headings; they sit fine in the new shell and are restyled in UR.4 / UR.5.
- The e2e specs haven't been re-run against the new shell yet; their nav selectors use link
  names, which the sidebar keeps (labels are visually hidden, not removed).

### 2026-10-20 — F5a AI legal tutor (F5a.1–F5a.6)

**Status:** Built on `feature/f5a-tutor` (cut from `master` after F4) and merged to `master` on
2026-10-20 at the user's request, **before the live-backend check** (still owed, below). Lint (one pre-existing warning), `tsc -b`, the build and 251 unit tests pass.
Roadmap change behind it (2026-10-19, decided by the user): backend Phase 5 (AI grading) is on
hold, so F5 is on hold too; Phase 5a (RAG tutor) was built instead; Phase 6 is split into 6a and
6b. Source: `docs/Lexly-F5a-Tutor-Brief.md` (from the backend repo); delete it once this entry
is closed, since its content is now in the plan, the UI spec and here.

**Blocked on the live check:** the running backend on `localhost:8080` is an older build (every
tutor route answers `No endpoint …`), so it needs a restart on `lexly-backend`
`feature/phase5a` (`a4f2bee`) with `LEXLY_AI_SERVICE_URL` / `LEXLY_AI_SERVICE_API_KEY` set. The
AI service is up (`/health` ok). Its Postgres and Redis containers had exited; they were
restarted with `docker start lexly-postgres-1 lexly-redis-1` (login was failing with
`INTERNAL_ERROR` without them). Still to do against Phase 5a: confirm `QUOTA_EXCEEDED` 429,
`AI_UNAVAILABLE` 503, `INDEX_RUN_IN_PROGRESS` 409, the `400`s on the spend range and the `404`
on an unknown conversation; run `e2e/f5a-tutor.spec.ts` (it skipped cleanly against the old
build); then the plan's "Done when" in the browser for each role (11th question, AI service
stopped, re-index, spend graph).

What changed:
- **Docs first:** contract re-copied from backend `feature/phase5a` (§0.8 codes, §11a). Plan:
  F5 on hold, F5a section and phase row, F6 → F6a, F6b row, three codes in §3.6. UI spec: F5a
  section (shell, tutor screen, tutor admin), §0.6 rows, phase index, changelog.
- **API:** `api/tutor.ts` (types and mappers for conversations, messages, citations, quota,
  index runs and daily usage; no client timeout on the ask call); `queryKeys.tutor.*`;
  `QUOTA_EXCEEDED`, `AI_UNAVAILABLE`, `INDEX_RUN_IN_PROGRESS` in `errors.ts`;
  `useCachedQuery` gains a `refetchInterval` option.
- **Shell:** `/tutor/:conversationId?` for every role (one optional-segment route, so the
  in-flight question survives a new chat getting its id), wide; Tutor nav item with a new
  `ChatIcon` for every role (SUPERADMIN, C_ADMIN and S_STUDENT now have 5); SUPERADMIN's also
  matches `/admin/tutor`; `/admin` hub card; `CollegeFilter` moved from the audit page to
  `components/` for reuse.
- **Tutor (F5a.3):** two panes from 1024 px (list or thread below it); chat list with
  "deletes in …" and delete-with-confirm; new-chat explainer with example questions; pending
  question with a live "Answering…" status, one question in flight; failed state with Try again
  / Edit question; quota line from each `POST` response and the quota banner; expired chats (on
  open and on send); answers as text nodes with `[n]` markers as buttons that focus their
  source; library sources link to `/sections/:id` / `/caselaws/:id`, `FILE` sources don't;
  not-found answers; composer with Enter / Shift+Enter, counter and client checks; disclaimer.
- **Tutor admin (F5a.4):** `/admin/tutor?tab=index|spend`. Index: Re-index with confirm, latest
  run card, 5 s polling only while the first run is `RUNNING`, finish announced, previous runs
  table / cards, `409` shown as "already running". Spend: from / to / college / role in the URL
  (India dates, default last 30 days; `to ≥ from` and ≤ 366 days inclusive checked first), stat
  tiles, hand-drawn SVG daily cost chart (hover and ←/→ tooltip, `role="img"` summary, Show as
  table), rate and exclusion footnotes.
- **Tests (F5a.6):** `api/tutor.test.ts` (mappers), `tutorFormat.test.ts` (marker parser:
  known / unknown / adjacent / inside words; India-midnight reset in four time zones; expiry;
  spend range), `tutor.test.tsx` (new chat → `/tutor/:id` by replace, citation links, case-law
  link, not-found answer, quota 429, unavailable + Try again, Edit question, blank check and
  Shift+Enter, expired on send and on open, delete, examples, nav and admin access),
  `tutorAdmin.test.tsx` (latest and previous runs, re-index + polling start/stop with fake timers,
  `409`, spend URL filters and request params, range checks), error copy, roles and App nav.
  Fixtures and MSW handlers for every §11a endpoint are in `src/test/tutor.ts`.
  `e2e/f5a-tutor.spec.ts` covers the golden path (re-index → student asks → opens the cited
  section → follow-up in the same chat) and skips when the service or the endpoints are missing.
- Checked the screens in headless Chromium with mocked responses (desktop tutor, phone tutor,
  index tab, spend tab with the tooltip).

### 2026-10-18 — F4 Manual grading & student results (F4.1–F4.7)

**Status:** Built and verified against backend `feature/phase4` (`0e1174e`, not merged to
`main` yet). Branch `feature/f4-grading`, cut from `master` after PR #4. Lint (one pre-existing
warning), `tsc -b`, the build and 206 unit tests pass. **Done once backend Phase 4 is merged to
`main` and the e2e suite is re-run against it** (plan §10 gate).

**Verified against the live backend** (`lexly-backend` `feature/phase4` at `0e1174e`; Flyway
applied V20 on start). `e2e/f4-grading.spec.ts` (6 tests, desktop) passes and covers the plan's
"Done when": the list and detail show 3 to grade; from the grid the professor opens Asha's Q1,
the PDF loads inline, approve is blocked without feedback, a draft saves, out-of-range marks are
refused, approve → confirm → read-only "8 / 10" with focus on Next ungraded; the student at once
sees "1 result published", Q1 8 / 10 with feedback and Q2 "Awaiting evaluation"; the professor
continues with Next ungraded (Q2 4.5 / 5, then lands on Vikram), the tiles read 1 to grade / 2
published and the Published filter works; the student's total reads 12.5 / 15; phone passes for
the results and the review. Axe scans pass on the grid, review and results.
`e2e/f3-assessments.spec.ts` still passes against the same backend (5 passed).

What changed:
- **Docs first:** contract re-copied from backend `feature/phase4` (§10 LIVE, §9 placeholders
  filled); UI spec F4 section written (shell, `GradeStatusLabel`, F4.1–F4.6, errors, audit).
- **API:** `api/grading.ts` (§10.1–10.3: review, file path, draft, approve; `grade.ai` left for
  F5), `toStudentResults` / `getStudentResults` in `api/student.ts` (§10.4; maps only the
  contract fields, feedback only when published), `GradeStatus` / `ReviewOrder` in
  `api/assessments.ts`, grid cells gain `gradeStatus` / `finalMarks`, the grid filter takes grade
  statuses. `INVALID_MARKS`, `GRADE_PUBLISHED` in `errors.ts`. Query keys `professorAnswers`,
  `studentAssessments.results`.
- **Professor:** `/professor/answers/:answerId` (F4.1–F4.4): split layout, inline `PdfPanel`
  (+ full-screen `PdfViewer`), grade panel (`gradeForm.ts`: draft / approve checks, server
  errors onto fields, banners), read-only once published or for a removed assessment, unsaved
  guard (new `ignoreSearch` option so the order select doesn't prompt), Previous / Next / Next
  ungraded with `?order=`, collapsible history. A save or approve patches the cached review and
  invalidates the reviews and all assessment views (F4.5). List: To grade / Published columns
  and card line; detail: two new tiles; grid: submitted cells are links showing the grade, the
  status filter gains To grade / Published, and a Grading order select.
- **Student:** `/student/assessments/:id/results` (F4.6), **View results** on the detail and per
  published card, results-available list cards link to the results with "{n} results published".
- **Shared:** `PdfViewer` split into `usePdfBlob` + `PdfViewer` / `PdfPanel`.
- **Audit:** `GRADE_EDITED` / `GRADE_PUBLISHED` summaries ("Question 2 · 7.5 marks").
- **Tests (F4.7):** `gradeForm.test.ts`, `grading.test.tsx` (review, Not Found, approve blocked
  without feedback / with invalid marks, draft body, `INVALID_MARKS`, approve → read-only,
  published read-only, `GRADE_PUBLISHED`, removed assessment, navigation + order, unsaved guard,
  history), `results.test.tsx` (mixed outcomes, nothing published, Not Found, no AI/draft fields,
  entry points), a grid test in `professor.test.tsx`, audit summaries. `e2e/api.ts` now holds
  the API helpers both golden paths use; the F3 grid assertion reads "To grade".

Notes:
- Found while writing the e2e (not changed, outside F4): signing out on `/profile` leaves
  `from: /profile` in the login page's history state, so the next user signing in on the same
  tab lands on `/profile` instead of their home. Harmless (the target must be a route the new
  role may open), but worth a small fix in `RedirectIfAuthenticated` / `logout`.
- The native `<dialog>` returns focus to its opener when it closes, which jsdom doesn't model:
  focus after a confirm must be moved in an effect that runs after the dialog's own close.

## Blocked

_Nothing blocked._ The auth status-code check from the Register & Login entry was done on
2026-09-23 against the live local backend: registering an existing email returns **409**
`{ "error": "EMAIL_ALREADY_EXISTS", "message": … }`, and a wrong password returns **401**
`{ "error": "UNAUTHORIZED", "message": "Invalid email or password" }`. Both use the
`{ error, message }` shape the client already handles, so no code change was needed.

## Next Up

From `docs/Lexly-Frontend-Implementation-Plan.md` §8, using its task IDs. Screen details are in
`docs/Lexly-UI-Spec.md`.

Backend Phase 0 and Phase 1 are done, so all of F0 and F1 can be built against a local backend
on `feature/phase1`.

1. ~~**F0 on `feature/f0-cleanup`**~~ — done 2026-10-14 (entry above). PR #2; CI passed.
2. ~~**F1 on `feature/f1-identity`**~~ — done 2026-10-14 (entry above). Merge PR #2, then #3.
3. ~~**F2 on `feature/f2-college-admin`**~~ — done 2026-10-14 (entry above), merged into `master`.
4. ~~**F3 on `feature/f3-assessments`**~~ — done 2026-10-16 (entry above). Commit, then merge into `master`.
5. **F4 on `feature/f4-grading`** — built and verified against backend `feature/phase4` 2026-10-18 (In Progress above). Done after backend Phase 4 merges to `main` and the e2e suite is re-run.
6. ~~F5 (AI evaluation UI)~~: on hold with backend Phase 5 (2026-10-19).
7. **F5a on `feature/f5a-tutor`**: built 2026-10-20 (In Progress above). Verify against backend `feature/phase5a` with the AI service, then Done once Phase 5a is merged.
8. F6a (rankings & statistics) once backend Phase 6a is agreed; F6b to be planned.
9. Later (D4): choose an app-wide dark-mode approach.
