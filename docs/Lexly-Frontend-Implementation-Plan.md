# Lexly — Frontend Implementation Plan (lexly-webui)

**Status:** Draft for review, revised 2026-10-15 (synced with backend Phases 0–3)
**Frontend repo:** https://github.com/LTHP1713/lexly-webui (reviewed at commit `fab9df4` "bare act & case laws")
**Backend state (2026-10-15):** Phases 0–3 are merged to `lexly-backend` `main` (Phase 3: `75a7c08`, PR #4). The contract copy in this repo matches it. Frontend F0, F1 and F2 are Done; F3 is in progress.
**Based on:** `Lexly-TDD.md` v2 (frozen 2026-10-12) and `Lexly-Implementation-Plan.md`. Request/response shapes: `Lexly-API-Contract.md`. Section references like §7.3 point to the TDD; "Phase 3" points to the backend plan.
**Companion docs:** `Lexly-UI-Spec.md` (layout, states and copy per screen, written per phase) and `Lexly-Frontend-Status-Report.md` (what is built).
**Supersedes:** `Lexly-Frontend-Development-Master-Doc.md` §3. Its prompts target the old subscription / MCQ-practice design. Its §4 (security) and §5 (progress SOP) still apply and are summarised in §9 and §10 below.

**Rule for every frontend phase:** a phase isn't done until `npm run build` (type-check + build), `npm run lint` and `npm test` pass, and its golden path has been exercised against a running `lexly-backend` with the matching backend phase applied. A frontend phase never ships before its backend phase; until then it can be built against MSW mocks of the TDD contract.

---

## 1. Where the frontend is today

`lexly-webui` is a Vite + React 19 + TypeScript SPA. It uses React Router 7 (`createBrowserRouter` with a splat route around `App`, so `useBlocker` works), CSS Modules and no UI kit. Its only runtime dependencies are React, the router and the self-hosted Source Serif 4 font.

### 1.1 Built and working

| Area | Where | Notes |
|---|---|---|
| **Cookie session** | `src/api/client.ts`, `src/api/auth.ts`, `src/auth/session-store.ts` | The refresh token lives only in the `HttpOnly` `lexly_refresh_token` cookie. `credentials: 'include'` is sent on auth calls only. On load, a bootstrap calls `/auth/refresh` and then `GET /users/me`, showing `SessionPending` meanwhile. Refreshes are serialised across tabs with a Web Lock (`lexly-auth-refresh`) and share one in-flight promise within a tab. Logout calls `POST /auth/logout` |
| **HTTP cache handling** | `client.ts` | In dev every GET uses `cache: 'no-cache'`. After a logout, GETs use `cache: 'reload'` for 5 minutes in every tab, so the next user never sees cached data |
| **Guards** | `RequireAuth`, `RedirectIfAuthenticated`, `RequireAdmin` | Signed-in users who open `/login` or `/register` go to `/dashboard` |
| **Auth screens** | `src/pages/auth/` | Redesigned: `AuthLayout` with an SVG illustration, `AuthField`/`PasswordField`, and `authForm.ts` mapping errors to friendly text |
| **Bare Acts reader** | `ActsPage`, `SectionsPage`, `SectionDetailPage`, `StudyPanel*`, `SectionDetail.module.css` | Study-panel layout. Left rail: reading progress, "On this page" with scroll-spy, "In this Act". Centre: a serif document with clause gutter, In simple words, Clause by clause, illustrations tagged Hypothetical or From the Act, exceptions with nested illustrations, and key legal terms. In Study mode, terms show definitions in popovers. Right rail: stats and insight cards. Breadcrumb and Previous/Next come from `actId`, `actTitle`, `prev` and `next`. Sections are sorted naturally on the client |
| **Case-law reader** | `CaseLawsPage`, `CaseLawDetailPage`, `caseLawLabels.ts` | Uses the same study panel. Shows the full structured content: issues (collapsible from 3 on), arguments as party cards, final holding with an outcome badge, ratio ("Binding"), obiter ("Not binding"), provisions, principles and related sections |
| **Case-law admin** | `src/pages/admin/`, `src/api/adminCaseLaws.ts` | List, create/edit metadata and delete. A structured content editor (`PUT /admin/caselaws/{id}/content`) with `RepeatableList` (add, move up/down, remove, live-region announcements). Server `VALIDATION_ERROR` paths map to inline row errors and an error summary. Unsaved-changes guard via `useBlocker` + `beforeunload`. Client limits mirror the server's `@Size` limits |
| **Reusable admin parts** | `ConfirmDialog` (native `<dialog>`), `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard`, `contentForm.ts` | Good candidates for `src/components/` (see F0.4) |
| **Free/Pro removed** | — | No `isFree`, `ProBadge`, locked teasers or free-flag calls remain (2026-10-11) |
| **Home** | `src/pages/home/` | Greeting from `/users/me` (`VITE_API_USERS_ME=true`), universal search (fan-out over `/sections/search`, `/caselaws?q=` and the cached `/acts`), quick actions, and Practice Progress, Bare-Act Progress and Continue Learning cards behind flags that are off |
| **Shell** | `AppLayout` | Header with "Hi {name}!", bell and avatar. Bottom tab bar below 768 px (Home / Bare Acts / Practice / Profile). A wide 72 rem layout for `/sections/*`, `/caselaws/*` and `/admin/*` |
| **Data hooks** | `useApiQuery`, `useDebouncedValue`, `useHomeData` | Keyed fetch with stale data, retry and superseded-response dropping |

### 1.2 Conventions to keep following

- `@/` → `src/`. One `src/api/<area>.ts` per backend area. DTOs are normalised by `to<Model>()` mappers: blank → `null`, missing list → `[]`. Components never see raw quirks.
- Filters, query and page live in the URL (page is 1-based in the URL, 0-based on the wire). Router state is only an optional "back to results" hint.
- One `<h1>` per screen, landmarks, `aria-live` for async results, `aria-busy` while refetching, keyboard-operable everything, and colour never the only signal.
- Loading, empty and error states exist for every card and list. One failing card never blanks a page.
- Backend `message`s are mapped to friendly text (`authForm.ts`, `contentForm.ts`); raw bodies and stacks are never shown.
- Every task gets an entry in `docs/progress/frontend_progress.md`: date, status, what changed, how it was verified against the live backend, and notes.

---

## 2. Gap analysis: what's left against TDD v2

Most of the drift from the old design was fixed in `fab9df4`. What remains:

| # | Gap | Action |
|---|---|---|
| G1 | Roles: the UI knows `STUDENT` / `LAWYER` / `ADMIN`. The role comes from decoding the JWT at login (`roleFromAccessToken`) and from `/users/me` on reload. `RequireAdmin` checks `role === 'ADMIN'`. **Since backend P1 those role names no longer exist** (V16 remaps them), so an `ADMIN` check fails for every user | Five roles, role-scoped areas and `RequireRole`. Take the role, `college` and `mustChangePassword` from `/users/me` after **every** login, not from the JWT (F0.2, F1) |
| G2 | The admin area is reached only through a link on Profile; there is no admin nav | Per-role navigation (F0.3) |
| G3 | MCQ practice is still referenced: the Home `PracticeProgress` card, the `practiceStats` flag and DTOs, the `/practice` placeholder, and the "Build the Practice flow…" item in Next Up | Remove it. `/practice` becomes Solo practice in F7 (F0.1) |
| G4 | The progress file's Next Up still listed "Upgrade to Pro" and the MCQ practice flow. `HOME_DASHBOARD_API_CONTRACT.md` described MCQ endpoints | Done 2026-10-13: Next Up rewritten from this plan; `HOME_DASHBOARD_API_CONTRACT.md` deleted (superseded by `Lexly-API-Contract.md`) |
| G5 | `apiClient` sets `Content-Type: application/json` whenever there is a body. There is no multipart upload, upload progress or binary download, and no `PATCH` | Needed for answer PDFs, solo attempts and CSV/XLSX imports (F0.5) |
| G6 | `ApiError` no longer keeps the error body (removed with the teasers) | Fine for now. Re-add only if a new endpoint returns extra fields on errors |
| G7 | Content admin covers case laws only. Acts, sections, illustrations, exceptions, case-law ↔ section linking and bulk JSON import have no UI | F1 |
| G8 | No automated tests; verification is ad-hoc Playwright runs | Vitest + Testing Library + MSW + a committed Playwright suite (F0.6) |
| G9 | Email-only login; no forced password change. Since backend P1, a seeded or reset account gets `403 PASSWORD_CHANGE_REQUIRED` on every call except `/users/me`, so it can't use the app at all | Two login modes and `/change-password` (F1) |
| G13 | Bulk import code expects the old all-or-nothing response (`201 { counts, created }` / `422 BULK_IMPORT_REJECTED`). Since backend P0 it is always `200 BulkImportResult` | F1.9 builds against the per-row shape; nothing in the UI calls the bulk endpoints today |
| G10 | Known edge case: navigating away while `/auth/refresh` is in flight can sign the user out (the server rotated the token, but the aborted response never delivered the new cookie) | Don't attach the bootstrap refresh to an abortable navigation. If it still happens, retry the refresh once after a 401 caused by a just-rotated token (F0.7) |
| G11 | Bare-Act Progress, Continue Learning, learning-activity tracking and unified `/search` aren't in TDD v2 | Keep the flags off and hide the cards (D3) |
| G12 | Dark mode: the palette is light-only | Decide in F8 (D4) |

---

## 3. Target architecture

### 3.1 One SPA, role-scoped areas

Keep one app and one repo. Keep the existing `src/pages/` convention and add one folder per role area. Each area is a lazily loaded route chunk, so a student never downloads grading code.

```
src/
├── api/                     one module per backend area: DTOs + to<Model>() mappers
│   ├── client.ts            JSON, multipart upload, blob download, refresh, cache modes
│   ├── errors.ts            error-code catalogue (§3.6)
│   ├── auth.ts users.ts content.ts caselaws.ts search.ts
│   ├── adminContent.ts adminCaseLaws.ts adminBulk.ts
│   ├── colleges.ts collegeUsers.ts subjects.ts
│   ├── professor.ts student.ts analytics.ts audit.ts solo.ts
├── auth/                    session store, AuthContext, guards, roles.ts
├── components/              shell + shared UI (moved here from pages/admin in F0.4):
│                            ConfirmDialog Toast Field RepeatableList useUnsavedChangesGuard
│                            DataTable Pagination StatusBadge FileDropzone PdfViewer
│                            ImportResultTable MarksInput DateTimeField EmptyState
├── pages/
│   ├── auth/  content/  home/            existing
│   ├── admin/                            SUPERADMIN: content, bulk, colleges, solo, audit
│   ├── college/                          C_ADMIN: users, imports, subjects, statistics
│   ├── professor/                        assessments, submissions grid, answer review
│   ├── student/                          assessments, answering, results
│   ├── analytics/                        ranking table (shared by 3 roles)
│   └── solo/                             S_STUDENT practice
├── hooks/  lib/  config/  dev/  test/
```

### 3.2 Roles, routing and home screens

`src/auth/roles.ts` holds the role union, each role's home path and its nav items. `AppLayout` renders the nav from that config. `RequireRole roles={[…]}` replaces `RequireAdmin`. A user who opens another role's URL goes to their own home. This is only a convenience; the server is the gate.

| Role | Home | Nav (header on desktop, bottom tabs on mobile) |
|---|---|---|
| `SUPERADMIN` | `/admin` | Colleges · Content · Solo · Audit · Library |
| `C_ADMIN` | `/college` | Users · Subjects · Statistics · Audit · Library |
| `C_PROFESSOR` | `/professor` | Assessments · Rankings · Library |
| `C_STUDENT` | `/student` | Assessments · Library |
| `S_STUDENT` | `/dashboard` | Home · Bare Acts · Practice · Profile (as today) |

"Library" is the shared read-only content: `/acts`, `/sections/:id`, `/search`, `/caselaws`, `/caselaws/:id`. Every role can read it (§2.1). `/profile` (name, email, college, change password, log out) exists for every role. `RedirectIfAuthenticated` sends users to their role's home instead of always `/dashboard`.

Route map (✅ = exists today):

```
Public        /login ✅  /register ✅
Gated         /change-password                 (the only route reachable while mustChangePassword)
All roles     /acts ✅  /acts/:actId ✅  /sections/:sectionId ✅  /search ✅
              /caselaws ✅  /caselaws/:id ✅  /profile ✅
SUPERADMIN    /admin
              /admin/caselaws ✅  /admin/caselaws/new ✅  /admin/caselaws/:id ✅  /admin/caselaws/:id/content ✅
              /admin/acts  /admin/acts/:actId  /admin/sections/:sectionId   (content admin)
              /admin/import                                                (bulk JSON)
              /admin/colleges  /admin/colleges/:id                         (admins, AI usage tabs)
              /admin/solo/subjects  /admin/solo/plans
              /admin/analytics?collegeId=  /admin/audit
C_ADMIN       /college  /college/users  /college/users/import  /college/users/:id
              /college/subjects  /college/subjects/:id
              /college/rankings/:subjectId  /college/students/:id  /college/audit
C_PROFESSOR   /professor  /professor/assessments/new  /professor/assessments/:id/edit
              /professor/assessments/:id  /professor/answers/:answerId  /professor/rankings/:subjectId
C_STUDENT     /student  /student/assessments/:id  /student/assessments/:id/results
S_STUDENT     /dashboard ✅  /practice ✅(placeholder)  /practice/new  /practice/questions/:id  /practice/answers
```

### 3.3 Data fetching

- Read-only screens keep `useApiQuery`.
- From F2 the app has many mutations that must refresh other views (import → user list, approve → grid and ranking), plus polling for AI jobs. **Recommendation:** add `@tanstack/react-query` in F2 rather than growing `useApiQuery` into a cache (D1). It has no transitive runtime dependencies. Query keys mirror API paths (`['professor','assessments',id,'answers',filters]`), mutations invalidate by prefix, and existing pages migrate only when next touched. The client's cache-mode logic (`no-cache` in dev, `reload` after logout) stays in `client.ts` and works underneath it unchanged.
- Polling is only for in-flight AI work (`AI_EVALUATING`, solo `EVALUATING`): every 3 s, backing off to 10 s, stopping on a terminal status or a hidden tab.

### 3.4 Forms

Build on what the case-law admin already has: `Field`, `contentForm.ts` (client limits mirroring `@Size`, mapping server `VALIDATION_ERROR` paths to fields and rows, error summary with links), `RepeatableList` and `useUnsavedChangesGuard`. Generalise `contentForm.ts` into `src/lib/forms.ts` when the second form type (sections) needs it. No form library.

New domain inputs:
- **`MarksInput`:** `step="0.5"`, `min=0`, `max=maxMarks`. Rejects non-multiples of 0.5 before submit (mirrors `INVALID_MARKS`).
- **`DateTimeField`:** wraps `<input type="datetime-local">`, shows the user's timezone, sends ISO-8601 UTC, and enforces "in the future" for `due_at`.
- **`FileDropzone`:** accepts PDFs (or CSV/XLSX for imports). Checks size and the `%PDF-` magic bytes on the client before uploading (the server re-checks). Shows upload progress and is keyboard operable.

### 3.5 Files

- **Upload:** a new `apiClient.upload(path, formData, { method, onProgress, signal })` built on `XMLHttpRequest`, because `fetch` has no upload progress. It sends no manual `Content-Type` and follows the same 401 → refresh → retry-once rule. `request()` must also skip the JSON `Content-Type` when the body is `FormData`.
- **Download/view:** files come only from access-checked endpoints that need the bearer header, so a plain `<a href>` won't work. `apiClient.download(path) → { blob, filename }` reads the filename from `Content-Disposition`. `PdfViewer` shows the blob in an `<iframe>` on an object URL using the browser's own PDF viewer (no pdf.js), and revokes the URL on unmount. Downloads always use `cache: 'no-store'`.
- **Professor side effect:** the first `GET /professor/answers/{id}/file` sets `professor_downloaded_at`, which enables AI Evaluate. Invalidate the answer query after the download resolves.

### 3.6 Error-code catalogue

`src/api/errors.ts` maps each `error` code to UI behaviour. Screens switch on codes, not on HTTP status.

| Code | UI behaviour |
|---|---|
| `UNAUTHORIZED` | Silent refresh once, then `/login` |
| `PASSWORD_CHANGE_REQUIRED` | Global: go to `/change-password` |
| `COLLEGE_INACTIVE` | Login banner: "Your college's account is inactive. Contact your administrator." |
| `FORBIDDEN` | "You don't have access to this page" + link to the role's home |
| `NOT_FOUND` | Not-found state. This is also the answer for out-of-scope ids (§2.2), so never hint that the id exists |
| `VALIDATION_ERROR` | Map `path: reason` onto fields (existing `contentForm.ts` parser); otherwise a form banner |
| `EMAIL_ALREADY_EXISTS`, `SHORT_CODE_ALREADY_EXISTS`, `SECTION_NUMBER_ALREADY_EXISTS`, `COLLEGE_CODE_ALREADY_EXISTS`, `LOGIN_ID_ALREADY_EXISTS`, `SUBJECT_CODE_ALREADY_EXISTS` | Inline on the field |
| `SUBJECT_IN_USE` | Delete dialog explains the subject has assessments; offers rename |
| `ASSESSMENT_NOT_EDITABLE` | Refetch; editor becomes read-only |
| `ASSESSMENT_CLOSED` | Refetch; the question card shows "Closed — not attempted" |
| `ANSWER_LOCKED` | Refetch; show as submitted |
| `INVALID_FILE` | Inline on the dropzone (the `message` says type, size or pages) |
| `GRADE_PUBLISHED` | Refetch; the grade form becomes read-only |
| `AI_EVALUATION_NOT_ALLOWED` | Inline: "Open the answer PDF first" or "Already published" |
| `INVALID_MARKS` | Inline on `MarksInput` |
| `PLAN_REQUIRED` (402) | Solo plan-gate screen |
| `QUOTA_EXCEEDED` (429) | Usage banner with the reset date; disable generate buttons |
| `ATTEMPT_LIMIT_REACHED` | Hide upload; "3 of 3 attempts used" |
| `IMPORT_FILE_INVALID` | Whole-file error on the import screen |
| `RATE_LIMITED` (429) | Toast "Too many requests, try again shortly" (the form banner on sign-in and change password); no automatic retry. The backend raises it only from P8 (contract §0.8), but handle it from F1 |
| `NETWORK_ERROR` | Retryable error state |

The exact copy for each code is in `Lexly-UI-Spec.md` §0.6. Confirm each new code's HTTP status against the live backend once per phase (as was done for `EMAIL_ALREADY_EXISTS`) and record it in the progress file.

### 3.7 Styling and UX baseline

- Keep CSS Modules and the `--lx-*` tokens. Add status tokens (draft, published, closed, removed, pending, AI, failed), always paired with a text label.
- The study panel stays the reading layout for the Library. New work areas (admin, college, professor) use the wide layout with a shared `DataTable`: sortable headers with `aria-sort`, a sticky header, server pagination over `PagedResponse`, and filters held in the URL.
- Professor and admin grids are desktop-first but scroll horizontally on tablets without breaking the page. Student screens are mobile-first (students will upload from phones).

### 3.8 Configuration

```
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_API_USERS_ME=true            # remove the flag in F0: /users/me is required from now on
VITE_API_UNIFIED_SEARCH=false     # not in TDD v2 (D3)
VITE_API_LEARNING_PROGRESS=false  # not in TDD v2 (D3)
VITE_HOME_MOCKS=                  # dev only, unchanged
```

Remove `VITE_API_PRACTICE_STATS`. There are no upload-limit variables: the student assessment detail returns `uploadLimits` (contract §9.3, B4).

### 3.9 Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Mappers (`toSectionDetail`, `toCaseLawDetail`), `compareSectionNumbers`, `contentForm` error parsing, `MarksInput` rules, error catalogue |
| Component | Vitest + Testing Library + user-event | Forms, `RepeatableList`, the answer card and grade panel state machines, a11y roles |
| Mocks | MSW, with handlers typed from `src/api` DTOs | Loading / empty / error / success for every screen. Also replaces ad-hoc Playwright route interception |
| E2E | Playwright, committed under `e2e/` | One golden path per role per phase against a live backend, at 390×844 and 1280×800, with an axe-core scan per screen |

CI: `lint → tsc -b → vitest run → vite build`.

---

## 4. Phase plan

Frontend phases mirror the backend phases. **F*n* starts once backend Phase *n*'s API contract is agreed and ships after Phase *n* is merged.** F0 needs only what the backend already has.

| Phase | Name | Backend dep | Size | State |
|---|---|---|---|---|
| F0 | Clean-up & foundations | current backend + Phase 0 | S | most groundwork done in `fab9df4`; backend P0 merged |
| F1 | Identity, roles, SUPERADMIN & content admin | Phase 1 | L | case-law admin done; backend P1 committed (`feature/phase1`), contract §1, §2, §5–§7 LIVE |
| F2 | College administration | Phase 2 | M | — |
| F3 | Assessments & answering | Phase 3 | L | backend P3 merged (`75a7c08`), contract §9 LIVE |
| F4 | Manual grading & student results | Phase 4 | M | — |
| F5 | AI evaluation UI | Phase 5 | S | — |
| F6 | Rankings & statistics | Phase 6 | M | — |
| F7 | Solo AI practice | Phase 7 | M | — |
| F8 | Payments & hardening | Phase 8 | M | — |

F6 can run alongside F5, as on the backend.

---

### F0 — Clean-up & foundations

**Goal:** remove what v2 dropped, and add the plumbing every later phase needs.

| # | Task | Details |
|---|---|---|
| F0.1 | Remove MCQ practice | Delete `PracticeProgress`, the `practiceStats` flag, its DTOs/mappers in `users.ts` and its mocks in `homeMocks.ts`. `/practice` becomes "Solo practice — coming soon". Hide the Bare-Act Progress and Continue Learning cards while their flags are off (D3). Already done 2026-10-13: Next Up rewritten from this plan, and the code comments and `.env.example` that cited the deleted `HOME_DASHBOARD_API_CONTRACT.md` now point at `Lexly-API-Contract.md` §15 |
| F0.2 | Role from `/users/me` | After login/register, call `GET /users/me` (as the bootstrap already does) and drop `roleFromAccessToken`. One source of truth, carrying `role`, `mustChangePassword`, `loginId` and `college: { id, code, name } \| null` (contract §2.1, LIVE). Type `role` as the union of the five roles (contract §0.7). The login/register response now also carries `role` and `mustChangePassword`; use them only to decide whether to go to `/change-password` before `/users/me` returns, never as the stored role |
| F0.3 | Role skeleton | `roles.ts`, `RequireRole` (replaces `RequireAdmin`), role-driven nav in `AppLayout`, role-aware `RedirectIfAuthenticated`, `React.lazy` per area, a real `NotFound` page (today `*` redirects to `/login`). The Library item goes to `/acts`, and the Library list pages get a Bare Acts · Case Laws · Search sub-nav for roles that have a single Library item; the SUPERADMIN Content item goes to `/admin/acts` with an Acts · Case laws · Import sub-nav. `/admin` redirects to `/admin/acts` until F1.4. **No legacy role mapping:** backend P1 already remapped `ADMIN` → `SUPERADMIN` and `STUDENT`/`LAWYER` → `S_STUDENT` (V16), so the UI only knows the five roles. An unrecognised role is treated as signed-in with Library access only |
| F0.4 | Shared components | Move `ConfirmDialog`, `Toast`, `Field`, `RepeatableList` and `useUnsavedChangesGuard` from `pages/admin/` to `src/components/`. Split the shared parts of `Admin.module.css` out with them. No behaviour change |
| F0.5 | Client extensions | Skip the JSON `Content-Type` for `FormData`; add `patch`, `upload` (XHR with progress) and `download` (blob + filename), and pass `AbortSignal` through. Add the `errors.ts` catalogue |
| F0.6 | Tests & CI | Vitest, Testing Library, MSW, Playwright, axe. Seed the suite with the mappers, `compareSectionNumbers`, `contentForm` parsing and the cookie-session flows from the 2026-10-09 entry. Add a GitHub Actions workflow |
| F0.7 | Session edge cases | Re-run the 2026-10-09 cookie checks against the **live** backend (still listed in Next Up). Fix G10 |

**Done when:** no MCQ code remains; a `SUPERADMIN` sees an admin nav without going through Profile; `npm test` runs in CI; the cookie-session checks pass against the live backend.

---

### F1 — Identity, roles, SUPERADMIN & content admin

**Goal:** all five roles log in and land in their own area. SUPERADMIN manages colleges, C_ADMINs, all legal content and the audit log.

| # | Task | Details |
|---|---|---|
| F1.1 | Two-mode login | `/login` gets two tabs on the existing `AuthLayout`: **Email** (SUPERADMIN, C_ADMIN, S_STUDENT) and **College** (college code, upper-cased as typed, + roll no / employee ID + password). Send exactly one shape (`{ email, password }` or `{ collegeCode, loginId, password }`); both or neither is a `400`. One generic error on `401` (§4.1); `403 COLLEGE_INACTIVE` gets its own banner. Remember the last-used tab name in `localStorage`, never credentials |
| F1.2 | Forced password change | `/change-password` (current, new, confirm; ≥ 8 chars, ≠ current, ≠ `loginId`, matching the backend's three `VALIDATION_ERROR` messages). The same route serves a voluntary change from Profile, with Cancel. While `mustChangePassword` is set, every route redirects here and the nav shows only Log out. A `403 PASSWORD_CHANGE_REQUIRED` from any call also redirects here. On success, **replace the in-memory access token with the one returned** (the gate is read from the token, so the old token stays gated), refetch `/users/me`, and go to the role's home |
| F1.3 | Registration | Unchanged; the result is always `S_STUDENT` (§4.3). The response now carries `role` and `mustChangePassword` |
| F1.4 | Role areas live | Role homes for all five roles. `/admin` becomes a hub (Colleges, Content, Audit). Placeholder homes for areas whose features come later |
| F1.5 | Profile | Name, email, role, college name/code, change password, log out. The "Admin: manage case laws" link is removed, since the admin area now has its own nav |
| F1.6 | Colleges | `/admin/colleges`: list (search, active filter), create/edit (code, name), and deactivate/reactivate with a `ConfirmDialog` saying every user in the college loses access. College detail **Admins** tab: create C_ADMIN, list, reset password, remove |
| F1.7 | Acts & sections admin | `/admin/acts`: list/create/edit/delete (`SHORT_CODE_ALREADY_EXISTS` inline). `/admin/acts/:actId`: ordered section list, create/delete (`SECTION_NUMBER_ALREADY_EXISTS` inline). `/admin/sections/:id`: an editor for every reader field (body text, in simple words, provision meaning, illustrations with the `hypothetical` flag, exceptions with nested illustrations, key legal terms) built with `RepeatableList` and saved with one full-replace `PUT /admin/sections/{id}`. The per-item illustration/exception endpoints and `…/reorder` are not used, because that `PUT` replaces the nested lists anyway. The editor loads `GET /admin/sections/{id}` and Edit act loads `GET /admin/acts/{id}` (both ADDED, LIVE since P1). A "View as reader" link. Same cache-bypass-after-save pattern as the case-law admin |
| F1.8 | Case-law ↔ section linking | Open item from the case-law admin entry. In the case-law form, a section picker (act → section list or search) calls `POST/DELETE /admin/caselaws/{id}/sections/{sectionId}`, replacing today's read-only list |
| F1.9 | Bulk JSON import | `/admin/import`: choose acts / sections / case laws, upload or paste JSON, parse on the client, submit. The response is always `200 BulkImportResult` (contract §5.5, LIVE since P0); `400` only for an invalid envelope. Then show the §7.1 result: summary counts and an `ImportResultTable` (index, key, status, errors), filterable by status, with "download rejected rows" (a JSON file in the same envelope holding only the rejected and failed rows, ready to fix and re-import). `ImportResultTable` is reused in F2 |
| F1.10 | Audit log | `/admin/audit` (college filter) and `/college/audit` (C_ADMIN; `GET /audit` is already open to them): filters for action, date range and college. Columns: time, actor + role, action, entity, and details (JSON rendered as text in an expandable row). A note that entries are kept for 30 days. Only send `action` / `entityType` values from the contract's lists (an unknown one is a `400`). P1 records only `LOGIN_FAILED`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `COLLEGE_CREATED`, `COLLEGE_UPDATED`, `USER_CREATED`, `USER_REMOVED` and `CONTENT_IMPORT`; the action filter lists all actions anyway |
| F1.11 | Tests | Both login modes; the forced-change redirect can't be bypassed by typing URLs; role guards; inactive-college message; import results with mixed outcomes; section editor round-trip (load → save unchanged → identical body, as done for case laws) |

**Backend asks:** B1, B2 (§6), both delivered in P1.

**Dev seed:** the V16 migration seeds the SUPERADMIN from `LEXLY_SUPERADMIN_EMAIL` / `LEXLY_SUPERADMIN_PASSWORD_HASH`. The backend's `.env.example` uses `superadmin@lexly.local` with password `lexly-superadmin-dev` (dev only), and the account starts with `mustChangePassword = true`.

**Done when:** SUPERADMIN logs in with the seeded credentials, is forced to change the password, creates a college and a C_ADMIN, and the C_ADMIN logs in and is forced to change theirs. SUPERADMIN edits a section and imports a sections batch with 3 bad rows, and the reader shows the changes.

---

### F2 — College administration

**Goal:** C_ADMIN manages users and subjects in the browser.

| # | Task | Details |
|---|---|---|
| F2.1 | React Query | Add `@tanstack/react-query` (D1) and migrate the F1 admin lists |
| F2.2 | User list | `/college/users`: Students / Professors tabs, search (name, email, login ID), server pagination; row actions edit, reset password, remove |
| F2.3 | Create/edit user | Name, email, roll no / employee ID; duplicate errors inline |
| F2.4 | Reset password | Confirm: "The password becomes their roll no / employee ID, and they must change it at next login" |
| F2.5 | Remove user | `ConfirmDialog` with typed confirmation (enter the login ID), since removal is a hard delete. The text explains the consequences per role (§4.7): a student's answers, grades and ranking entries are deleted; a professor's assessments stay as "Former professor" and their ungraded answers can no longer be graded |
| F2.6 | Bulk import | `/college/users/import` with Students / Professors tabs: template download (D7), `FileDropzone` (`.csv`, `.xlsx`), upload with progress, then `ImportResultTable` with `CREATED / CONVERTED / REJECTED / FAILED`. `CONVERTED` rows explain that the solo account was converted and its solo data deleted. `IMPORT_FILE_INVALID` is a whole-file error |
| F2.7 | Subjects | List/create/edit (code, name, description); delete with the `SUBJECT_IN_USE` explanation. Subject detail: a searchable professor multi-select saved through `PUT /college/subjects/{id}/professors` |
| F2.8 | Read-only subjects | Professors: "My subjects". Students: college subjects (used as filters in F3) |
| F2.9 | Tests | All 4 import outcomes; the remove dialog needs the exact login ID; another college's user id shows Not Found |

**Done when:** C_ADMIN imports a students file with a duplicate, a bad email and a conversion, reads the per-row results, creates subjects and maps professors, and an imported student logs in with college code + roll no.

---

### F3 — Assessments & answering

**Goal:** professors author and publish assessments. Students upload and submit answers per question.

| # | Task | Details |
|---|---|---|
| F3.1 | Professor list | `/professor`, with filters for subject and status (`DRAFT / PUBLISHED / CLOSED / REMOVED`). Columns: title, subject, due date, status, and the §7.5 counts. F3 shows submitted and not attempted; the grading counts are 0 until backend P4, so F4/F5 add pending evaluation, AI evaluated and published |
| F3.2 | Draft editor | Subject (mapped only), title, instructions, due date (`DateTimeField`), and 1–50 questions in a `RepeatableList`, each with text, max marks (`MarksInput` > 0) and word limit (> 0). Running total of marks; unsaved-changes guard; explicit save |
| F3.3 | Publish | A pre-flight checklist mirroring §6.1, each failure linked to its field. Confirm: "Once published, nothing can be edited and the due date can't be extended" |
| F3.4 | Delete / remove | Drafts: delete. Published or closed: Remove, with a confirm explaining it disappears from students and rankings |
| F3.5 | Student list | `/student`: cards grouped by state (`OPEN`, `PARTIALLY_SUBMITTED`, `SUBMITTED`, `CLOSED`, `RESULTS_AVAILABLE`), a subject filter, and a relative due countdown (warning colour under 24 h) |
| F3.6 | Student assessment | Instructions and due date, then one card per question showing text, max marks, word limit and the §6.2 state machine: **Not uploaded** → **Uploaded** (filename, size, time, View, Replace, **Submit**) → **Submitted** (locked, View). Submit confirm: "You can't change this answer after submitting." After the due date the cards are read-only, and an unsubmitted upload is explained as "Not attempted". The countdown uses `serverTime` from the detail response to correct the device clock |
| F3.7 | Upload | `PUT /student/questions/{qid}/answer` via `apiClient.upload` with progress; client checks first, using `uploadLimits` from the assessment detail; `INVALID_FILE` inline; `ASSESSMENT_CLOSED` triggers a refetch. View your own file in `PdfViewer` |
| F3.8 | Submissions grid | `/professor/assessments/:id`: questions plus a students × questions grid. Each cell is an icon + text status; filters for question and status; paged by student; sticky first column and header. A cell opens the answer review (F4) |
| F3.9 | ~~SUPERADMIN read-only~~ | Dropped 2026-10-15: SUPERADMIN has no access to college assessments or answers (A9 changed, TDD §15; contract §9.6) |
| F3.10 | Tests | Each answer-card transition and each 409; the publish checklist; countdown boundaries; another professor's assessment shows Not Found |

**Backend asks:** B3, B4, B5, B6 (all met by backend P3).

**Done when:** the backend Phase 3 scenario works in the browser. A 10-question assessment is published; a student uploads, replaces and submits 7 answers; after the due date the student sees 3 "Not attempted", and the professor's grid matches.

---

### F4 — Manual grading & student results

**Goal:** the full college flow without AI.

| # | Task | Details |
|---|---|---|
| F4.1 | Answer review | `/professor/answers/:answerId`, a split layout (stacked on narrow screens). Left: question, max marks, word limit, student name/roll no, and the PDF (loaded from `GET /professor/answers/{id}/file`, which records the download). Right: the grade panel |
| F4.2 | Grade panel | Final marks (`MarksInput`, 0..max) and final feedback (with a character count). **Save draft** (`PUT …/grade`, not visible to the student) and **Approve & publish** (`POST …/approve`), whose confirm says the student sees it immediately and it can't be changed. After publishing, the panel is read-only with a Published badge and time |
| F4.3 | Grading flow | "Next ungraded" / "Previous" in the order chosen in the grid (by student or by question). The unsaved-changes guard applies |
| F4.4 | Grade history | A collapsible timeline from `AnswerReview.history` (contract §10.1; always returned) |
| F4.5 | Counts refresh | The assessment list and detail counts update after each approve |
| F4.6 | Student results | `/student/assessments/:id/results`: for each **published** question, marks / max and the professor's feedback. Unpublished questions show "Awaiting evaluation"; not attempted shows 0. The total is labelled "of published questions". The student DTO types contain no AI fields (§7.8) |
| F4.7 | Tests | Approve blocked without feedback or with invalid marks; published is read-only; results with a mix of published and unpublished questions |

**Done when:** a professor approves question by question, and the student sees each mark as soon as it's approved.

---

### F5 — AI evaluation UI

| # | Task | Details |
|---|---|---|
| F5.1 | AI Evaluate button | In the grade panel. Disabled, with the reason shown, until the PDF has been opened, and after publishing. Clicking it queues a job → `AI_EVALUATING` |
| F5.2 | Polling | Poll `GET /professor/answers/{id}` (§3.3) until `AI_EVALUATED` / `AI_FAILED`. Show status text, not a fake percentage. Grid cells update through invalidation |
| F5.3 | AI suggestion | A read-only "AI suggestion (provisional)" block: marks, feedback, estimated words vs. the word limit, and flags as labelled chips with plain-language help (`WORD_LIMIT_EXCEEDED`, `ILLEGIBLE`, `OFF_TOPIC`, `BLANK`, `LOW_CONFIDENCE`). **Use AI marks & feedback** copies them into the editable fields; approval is still manual |
| F5.4 | Failure | `AI_FAILED`: error summary, Retry, and a reminder that manual grading is always available |
| F5.5 | Grid & usage | New statuses in the grid legend and filters. SUPERADMIN college detail: an **AI usage** tab with token/cost totals (Phase 5.8) |
| F5.6 | Tests | Button enablement; polling starts and stops; "Use AI marks" doesn't approve |

**Done when:** a professor opens a PDF, clicks AI Evaluate, sees provisional marks appear without reloading, edits them and approves.

---

### F6 — Rankings & statistics

| # | Task | Details |
|---|---|---|
| F6.1 | Ranking table | `GET /analytics/subjects/{id}/ranking`: rank, name, roll no, obtained / max, score %. Ties share a rank (1, 1, 3), sorted by name within a rank, as returned. Every student appears, including 0%. Client-side name search. No export (out of scope) |
| F6.2 | Subject picker | C_ADMIN: all subjects. C_PROFESSOR: mapped subjects only. SUPERADMIN: college, then subject (`?collegeId=`) |
| F6.3 | C_ADMIN overview | `/college`: per subject, the assessments (published / closed / removed), questions, submitted, pending, published and average %. Stat tiles + table; an optional plain-SVG bar chart of average % |
| F6.4 | Per student | `/college/students/:id`: per subject %, rank, attempted vs. published, pending |
| F6.5 | Freshness | "Updated {time}" under the rankings, from the response's `generatedAt` (cached up to 5 minutes) |
| F6.6 | Tests | Ties; zero-total subject; a professor can't pick unmapped subjects; students have no ranking route |

**Done when:** the screens match the backend's hand-calculated fixture.

---

### F7 — Solo AI practice (S_STUDENT)

| # | Task | Details |
|---|---|---|
| F7.1 | Plan gate | `/practice` checks `GET /solo/usage` (or any 402). With no active plan: what the plan includes, and "Contact us to activate" (no checkout until F8). The Library stays available |
| F7.2 | Usage meter | "X of 60 generations used this month · resets on {resetsAt}" on every solo screen (`GET /solo/usage`). At 60, generate buttons are disabled; `QUOTA_EXCEEDED` shows the same banner |
| F7.3 | Generate question | `/practice/new`: subject (`GET /solo/subjects`), difficulty (`EASY / MEDIUM / HARD`), word limit (50–2000), and max marks as a segmented control (`5 / 10 / 15 / 20 / 25`). Pending state while the AI runs, then the question page |
| F7.4 | Attempts | `/practice/questions/:id`: the question, its parameters and expiry (30 days). Up to 3 attempts: upload PDF → `EVALUATING` (polling) → marks, feedback, flags (shared `AiSuggestion` chips). "Attempt 2 of 3". A failed evaluation offers Retry and is explained as not using up an attempt |
| F7.5 | Generate answer | `/practice/answers`: question text → AI answer, rendered as **plain text** with paragraphs (reuse the study panel's `RichText` only if it stays plain-text-safe). Copy button; a note that it may use general legal knowledge |
| F7.6 | History | Questions, attempts and answers from the last 30 days, each with its expiry |
| F7.7 | SUPERADMIN | `/admin/solo/subjects` (CRUD, active toggle) and `/admin/solo/plans` (find a user by email; set the period; see status and source) |
| F7.8 | Home | The S_STUDENT dashboard gets a Practice card (usage, latest result, "Generate a question") where Practice Progress used to be |
| F7.9 | Tests | Plan gate; quota 59 → 60 → blocked; attempt limit; polling stops |

**Done when:** a solo student with a manually activated plan completes generate → upload → feedback, and the 61st generation shows the quota banner.

---

### F8 — Payments & hardening

| # | Task | Details |
|---|---|---|
| F8.1 | Checkout | Per the payment addendum (D8): plans, the gateway's hosted checkout, then "Payment received, confirming…" polling the plan status (the webhook is the source of truth) |
| F8.2 | Accessibility | WCAG 2.2 AA pass on every screen. Manual keyboard and screen-reader checks on the review screen, the answer cards and the grids |
| F8.3 | Performance | Per-role chunks verified; a budget of ≤ 200 KB gzip for the initial S_STUDENT chunk (the serif font subset included); Lighthouse on a mid-range phone profile |
| F8.4 | Dark theme | If D4 says yes: a token-level dark palette |
| F8.5 | Security | CSP (`default-src 'self'`, `connect-src` the API origin, `frame-src blob:` for `PdfViewer`); dependency audit; confirm no token, blob URL or personal data reaches logs; production CORS origin |
| F8.6 | Error monitoring | Optional, after approval (D9), with request bodies and id-bearing URLs redacted |
| F8.7 | E2E matrix | One Playwright journey per role, plus "wrong role opens URL → redirected" per area |

---

## 5. Shared component inventory

| Component | Status | First needed |
|---|---|---|
| `ConfirmDialog`, `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard` | ✅ exist in `pages/admin/`; move in F0.4 | — |
| `StudyPanel` (`ReadingProgress`, `OnThisPage`, `Insights`, `DocPart`, `RichText`) | ✅ | Library |
| `LoadingState`, `ErrorState` | ✅ | — |
| `RequireRole`, role nav config, `NotFound` | new | F0 |
| `DataTable` + `Pagination` (URL filters) | new | F1 |
| `ImportResultTable` | new | F1 |
| `FileDropzone` + upload progress | new | F2 |
| `StatusBadge`, `DateTimeField`, countdown, `MarksInput`, `PdfViewer` | new | F3 |
| `AiSuggestion`, `AiFlagChips` | new | F5 |
| `RankingTable`, `StatTile` | new | F6 |
| `UsageMeter`, `PlanGate` | new | F7 |

---

## 6. Backend asks

Status as of the contract after backend Phase 1 (2026-10-13). "In contract" means proposed there; it still needs sign-off at the start of its phase. "LIVE" means implemented.

| # | Ask | Needed by | Status |
|---|---|---|---|
| B1 | `GET /users/me` adds the college and `mustChangePassword` (it already has `role`) | F1 | **LIVE (P1).** Nested `college: { id, code, name }` (or `null`), plus `mustChangePassword` and `loginId` (contract §2.1) |
| B2 | `POST /auth/change-password` returns a new access token and sets the rotated refresh cookie | F1 | **LIVE (P1).** Returns `{ accessToken, refreshToken, mustChangePassword }` and revokes every other refresh token (contract §1.5) |
| B3 | CORS `exposedHeaders: Content-Disposition, Location`; production origin | F3 / F8 | **`Content-Disposition` LIVE (P3)**, contract §0.6. `Location` isn't mentioned; ask only if a screen needs it. Production origin open (D6) |
| B4 | Upload limits exposed so the client checks match the server | F3 | **LIVE (P3).** `uploadLimits` in the student assessment detail (contract §9.3): 5 MB and 10 pages (O4, decided 2026-10-15) |
| B5 | Agreed response shapes for the student assessment detail, professor grid, answer review (with history) and solo usage (with period end) | F3–F7 | In contract §9.3, §9.5, §10.1, §13.2 |
| B6 | Every list endpoint returns `PagedResponse` with server-side filters | F2 / F3 | In contract §0.4 and §9.5 |
| B7 | Confirm the HTTP status of each new error code in §3.6 | each phase | Registry in contract §0.8; still check live per phase. P1 codes LIVE: `PASSWORD_CHANGE_REQUIRED` 403, `COLLEGE_INACTIVE` 403, `COLLEGE_CODE_ALREADY_EXISTS` 409. `BULK_IMPORT_REJECTED` removed (P0). `RATE_LIMITED` moved to P8 |
| B8 | Sort `GET /acts/{id}/sections` by natural section order on the server | any | Contract §3.2 makes the server the source of truth; verify live |

---

## 7. Decisions to make

| # | Decision | Recommendation |
|---|---|---|
| D1 | Data-fetching library for mutation-heavy screens | Add TanStack Query in F2 |
| D2 | Separate `lexly-webui` repo | Keep it. One SPA with per-role chunks |
| D3 | Bare-Act Progress, Continue Learning and unified search (not in TDD v2) | Hide now; revisit after F8 |
| D4 | Dark mode | Light-only until F8 |
| D5 | Upload size and page limits | **Decided 2026-10-15 (backend P3):** 5 MB and 10 pages, read from `uploadLimits` |
| D6 | Production domains | SPA and API same-site (e.g. `app.` + `api.` subdomains) or one origin behind a reverse proxy, so the `SameSite=Lax` refresh cookie keeps working |
| D7 | CSV/XLSX templates | Approved with backend Phase 2 |
| D8 | Payment gateway UX | From backend Phase 8 |
| D9 | Client error monitoring | Only with redaction and explicit approval |

---

## 8. Immediate next steps

Backend Phase 0 and Phase 1 are done, so F0 and F1 can be built against the real API (a local `lexly-backend` on `feature/phase1`), not mocks.

1. **F0 first, urgently.** Against a P1 backend the current UI is broken for two groups: admins (the `ADMIN` checks never match `SUPERADMIN`) and any account with `mustChangePassword` (every call except `/users/me` returns `403 PASSWORD_CHANGE_REQUIRED`, including the seeded SUPERADMIN). F0.2 + F0.3 fix the first; F1.2 fixes the second, so pull F1.2 forward into the same branch.
2. F0.1, F0.4, F0.5 on the same branch (`feature/f0-cleanup`).
3. F0.6 test harness, seeded with the existing mappers and form parsers.
4. F0.7: re-run the cookie checks against the live backend.
5. F1 on `feature/f1-identity`: F1.1, F1.4, F1.5, F1.6, F1.10 (identity and SUPERADMIN), then F1.7, F1.8, F1.9 (content), then F1.11.
6. Ship F1 only after `feature/phase1` is merged to backend `main` (§10 gate).

---

## 9. Security rules (frontend)

1. The access token is held in memory only; the refresh token exists only in the `HttpOnly` cookie. No auth data in Web Storage. The only `localStorage` uses are the cache-bypass timestamp and, from F1, the login tab name.
2. Render all backend text as plain text. The only markup parsing is `HighlightedSnippet` (`<b>` → `<mark>`) and the study panel's `RichText` list/label formatting, both built from text nodes. Never use `dangerouslySetInnerHTML`, including for AI output.
3. Student answers, feedback and marks are personal data. Keep them out of URLs, logs, analytics and error tracking. URLs carry ids, never names or roll numbers.
4. Revoke PDF object URLs on unmount. Never cache answer files (`cache: 'no-store'`, no service worker).
5. A 404 for another college's or professor's resource is shown as Not Found, never as "no access".
6. Role checks in the UI are only for convenience; the server enforces access.
7. No new third-party script or network origin without approval; audit each new dependency.

---

## 10. Working agreement

- **Progress:** `docs/progress/frontend_progress.md` in `lexly-webui`, using this plan's task IDs (e.g. "F3.6 Student assessment"). Each entry has the date, status, what changed, verification (live backend or mocks, plus which checks), and notes.
- **Gate:** a task is Done only when its backend counterpart is merged and the task has been exercised against the live backend.
- **Commits:** Conventional Commits (`feat(student): per-question answer upload`), one commit per task or small group of tasks, a branch per phase, never directly to `main`.
- **Session start:** read the progress file and this plan, check the backend phase status, then continue from the In Progress / Blocked notes.
