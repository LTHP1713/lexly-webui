# Lexly Frontend — Status Report

**Date:** 2026-10-13
**Repo state:** `master` at `fab9df4` ("bare act & case laws"). The doc sync is on branch `docs/sync-frontend-plan`.
**Compared against:** `Lexly-Frontend-Implementation-Plan.md` (revised 2026-10-13) and `Lexly-API-Contract.md` (identical to the backend repo's copy on 2026-10-13).
**Method:** I checked each plan task against the code, `package.json` and `docs/progress/frontend_progress.md`. I did not run the app or the backend for this report.
**Update, same day (backend P0 + P1):** backend Phase 0 is merged to `lexly-backend` `main` (`0545ab9`) and Phase 1 is committed on `feature/phase1` (`ddac579`, not yet merged). `docs/Lexly-API-Contract.md` was re-copied from that commit, and §1, §3 and §5 below were updated. F0 and all of F1 are now unblocked.
**Update, 2026-10-14 (F0 and F1 built):** F0 is done on `feature/f0-cleanup`, and all of F1 is built on `feature/f1-identity` (stacked on F0). Both were exercised against the live backend (`feature/phase1`, `ddac579`): `npm run test:e2e` 24 passed, 10 skipped by design. Backend `feature/phase1` was then merged to `main` (`ca7c842`) and the e2e suite re-run against it: 24 passed, 10 skipped by design, 0 failed, so F1 is Done (plan §10 gate). PRs: #2 (F0) and #3 (F1, stacked on #2). §1–§3 below are updated; the progress file has the details.
**Update, 2026-10-13:** the doc findings in §4 have been applied. The plan and `Lexly-UI-Spec.md` now agree, and the stale references to the deleted Home contract in the code comments and `.env.example` are fixed. The progress file was restored and its Next Up rewritten from this plan; see §4.4.

---

## 1. Summary

- **Done:** everything the plan lists as "built and working" (§1.1). That covers the reading app (Bare Acts, Case Laws, search, Home), email login and register with the cookie session, the case-law admin, and the free/Pro removal. The code matches the plan's description.
- **F0 done (2026-10-14):** F0.1–F0.7 on `feature/f0-cleanup`, with F1.2 pulled in. The cookie-session checks pass against the live backend.
- **F1 done (2026-10-14):** F1.1–F1.11 on `feature/f1-identity` (PR #3). Backend Phase 1 is merged to `main` (`ca7c842`), and the e2e suite passes against it.
- **Blocked on the backend:** F2–F8 (Phases 2–8 still PROPOSED).
- **Fixed:** the UI no longer breaks against a P1 backend. Roles come from `/users/me`, `RequireRole` replaced `RequireAdmin`, and gated accounts are sent to `/change-password`.
- **Docs:** the UI spec, the plan and the contract are now in sync (§4). The UI spec covers F0 and F1, including F1.7 and F1.8. The progress file was restored and its Next Up rewritten (§4.4).

| Phase | Tasks | Done | Can start now | Blocked by backend |
|---|---|---|---|---|
| F0 Clean-up & foundations | 7 | 7 | — | — |
| F1 Identity, roles, SUPERADMIN, content admin | 11 | 11 | — | — |
| F2 College administration | 9 | 0 | — | Phase 2 |
| F3 Assessments & answering | 10 | 0 | — | Phase 3 |
| F4 Manual grading & results | 7 | 0 | — | Phase 4 |
| F5 AI evaluation UI | 6 | 0 | — | Phase 5 |
| F6 Rankings & statistics | 6 | 0 | — | Phase 6 |
| F7 Solo AI practice | 9 | 0 | — | Phase 7 |
| F8 Payments & hardening | 7 | 0 | Partly (F8.2–F8.5 need nothing new) | Phase 8 for F8.1 |

---

## 2. Completed (before this plan)

These match the plan's §1.1. The progress file has the full entries and how each was verified.

| Area | Evidence | Progress entry |
|---|---|---|
| Email register / login, redesigned auth screens | `src/pages/auth/`, `authForm.ts` | 2026-09-23, 2026-10-06 |
| Cookie session: refresh on load, Web Lock across tabs, logout | `src/api/client.ts`, `src/auth/session-store.ts` | 2026-10-09 |
| HTTP cache handling (dev `no-cache`, `reload` after logout) | `client.ts` | 2026-10-11 |
| Guards: `RequireAuth`, `RedirectIfAuthenticated`, `RequireAdmin` | `src/auth/` | 2026-10-06 |
| Bare Acts reader with the study panel | `ActsPage`, `SectionsPage`, `SectionDetailPage`, `StudyPanel*` | 2026-09-23, 2026-10-08 |
| Case-law reader with structured content | `CaseLawsPage`, `CaseLawDetailPage` | 2026-10-10 |
| Case-law admin: list, metadata form, structured content editor | `src/pages/admin/`, `src/api/adminCaseLaws.ts` | 2026-10-10 |
| Reusable parts: `ConfirmDialog`, `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard` | `src/pages/admin/` (not yet moved) | 2026-10-10 |
| Free/Pro removed | No `isFree` or `ProBadge` left in `src/` | 2026-10-11 |
| Home: greeting, universal search, quick actions | `src/pages/home/` | 2026-10-05 |
| Shell: header, bottom tab bar, wide layout | `AppLayout` | 2026-10-06 |

**Closed by F0.7 (2026-10-14):** the 2026-10-09 cookie checks now run against the live backend as `e2e/f0-cookie-session.spec.ts`, and G10 (navigating away mid-refresh) passes with the `keepalive` fix.

---

## 3. Yet to be done, task by task

**Status key:** *Not started* = no code for it; *Partial* = some of it exists; *Ready* = can start now; *Blocked* = waits for a backend phase.

### F0 — Clean-up & foundations (no backend dependency)

| # | Task | Status | What the code shows today |
|---|---|---|---|
| F0.1 | Remove MCQ practice | Done (`831bc7c`) | No MCQ code left; `/practice` is the Solo practice placeholder; the Progress and Continue Learning cards are hidden (D3) |
| F0.2 | Role from `/users/me` | Done (`2c60601`) | `roleFromAccessToken` is gone |
| F0.3 | Role skeleton | Done (`2c60601`) | `roles.ts`, `RequireRole`, role nav, NotFound, lazy areas, Library and Content sub-navs |
| F0.4 | Shared components to `src/components/` | Done (`e5af6e3`) | |
| F0.5 | Client extensions | Done (`6e0f896`) | `FormData`, `patch`, `upload`, `download`, `AbortSignal`, `errors.ts` |
| F0.6 | Tests & CI | Done (`f63ff60`) | Vitest + MSW, Playwright + axe, CI workflow (passes on PRs #2 and #3) |
| F0.7 | Session edge cases | Done (`4e688f4`) | Cookie checks live; G10 fixed |

### F1 — Identity, roles, SUPERADMIN & content admin (backend Phase 1)

| # | Task | Status | Notes |
|---|---|---|---|
| F1.1 | Two-mode login | Done | Email and College tabs; tab name remembered |
| F1.2 | Forced password change | Done | Pulled into F0 (`2c60601`) |
| F1.3 | Registration | Nothing to do | Always `S_STUDENT` |
| F1.4 | Role areas live | Done | `/admin` hub; `/college`, `/professor`, `/student` placeholders |
| F1.5 | Profile | Done | Name, email, role, college, roll no. / employee ID |
| F1.6 | Colleges + C_ADMIN accounts | Done | List, add, detail with Admins tab, rename, (de)activate, add / reset / remove admin with a one-time share step |
| F1.7 | Acts & sections admin | Done | Acts list, act detail, full section editor (one `PUT`) |
| F1.8 | Case-law ↔ section linking | Done | Picker dialog; link / unlink at once |
| F1.9 | Bulk JSON import | Done | `ImportResultTable`, download rejected rows |
| F1.10 | Audit log | Done | `/admin/audit` and `/college/audit` |
| F1.11 | Tests | Done | 113 unit tests; e2e golden path + phone pass |

### F2–F8

None of these have code. Each waits for its backend phase.

| Phase | Tasks | Backend dependency | Contract |
|---|---|---|---|
| F2 | F2.1 React Query · F2.2 user list · F2.3 create/edit user · F2.4 reset password · F2.5 remove user · F2.6 bulk import · F2.7 subjects · F2.8 read-only subjects · F2.9 tests | Phase 2 | §8 |
| F3 | F3.1 professor list · F3.2 draft editor · F3.3 publish · F3.4 delete/remove · F3.5 student list · F3.6 student assessment (answer cards) · F3.7 upload · F3.8 submissions grid · F3.9 SUPERADMIN read-only · F3.10 tests | Phase 3 | §9 |
| F4 | F4.1 answer review · F4.2 grade panel · F4.3 grading flow · F4.4 history · F4.5 counts refresh · F4.6 student results · F4.7 tests | Phase 4 | §10 |
| F5 | F5.1 AI Evaluate button · F5.2 polling · F5.3 AI suggestion · F5.4 failure · F5.5 grid & AI usage · F5.6 tests | Phase 5 | §11 |
| F6 | F6.1 ranking table · F6.2 subject picker · F6.3 C_ADMIN overview · F6.4 per student · F6.5 freshness · F6.6 tests | Phase 6 | §12 |
| F7 | F7.1 plan gate · F7.2 usage meter · F7.3 generate question · F7.4 attempts · F7.5 generate answer · F7.6 history · F7.7 SUPERADMIN · F7.8 Home card · F7.9 tests | Phase 7 | §13 |
| F8 | F8.1 checkout · F8.2 accessibility · F8.3 performance · F8.4 dark theme · F8.5 security · F8.6 error monitoring · F8.7 E2E matrix | Phase 8 (F8.1 only) | §14 (placeholder) |

### Shared components (plan §5)

| Component | Status | First needed |
|---|---|---|
| `ConfirmDialog`, `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard` | Exist in `src/components/` (F0.4) | — |
| `StudyPanel`, `LoadingState`, `ErrorState`, `EmptyState` | Exist | — |
| `RequireRole`, role nav config, `NotFound` | Exist (F0.3) | F0 |
| `Pagination`, `ImportResultTable`, `StatusBadge`, `Dialog`, `TypedConfirmDialog`, `RowMenu`, `useMediaQuery` | Exist (F1) | F1 |
| `DataTable` | Not built as a component: F1 lists use the shared table/card styles in `ui.module.css` and `useMediaQuery`. Extract one in F2 if the user lists repeat the pattern | F2 |
| `FileDropzone` | Missing | F2 |
| `DateTimeField`, countdown, `MarksInput`, `PdfViewer` | Missing | F3 |
| `AiSuggestion`, `AiFlagChips` | Missing | F5 |
| `RankingTable`, `StatTile` | Missing | F6 |
| `UsageMeter`, `PlanGate` | Missing | F7 |

---

## 4. Findings from comparing the documents

**Status:** §4.1–§4.3 were applied on 2026-10-13. The plan's §6 now has a Status column; F0.1, F0.3, F1.2, F1.4, F1.7, F1.9, F3.6, F3.7, F4.4, F6.5 and F7.2 were updated, and three codes were added to §3.6. The UI spec was revised to the plan's routes and navigation. The tables below are kept as the record of what changed.

### 4.1 Backend asks (plan §6) against the contract

| Ask | Status in the contract | Action |
|---|---|---|
| B1 `/users/me` college fields + `mustChangePassword` | Covered by §2.1 (P1), but as a nested `college: { id, code, name }`, not flat `collegeId` / `collegeName` / `collegeCode` | Update the plan to the nested shape |
| B2 change-password returns tokens and rotates the cookie | Covered by §1.5 | Close |
| B3 CORS exposes `Content-Disposition` | §0.6 covers `Content-Disposition` (P3). `Location` isn't mentioned | Ask for `Location` too, or drop it if nothing uses it |
| B4 upload limits exposed | Covered: `uploadLimits` in the student assessment detail (§9.3). The values are still open (O4) | Drop the `VITE_MAX_UPLOAD_*` env vars once P3 lands |
| B5 response shapes for student detail, grid, review + history, solo usage | All defined (§9.3, §9.5, §10.1, §13.2), still PROPOSED | Review them at each phase's sign-off |
| B6 paged lists with server filters | Covered (§0.4; grid in §9.5) | Close |
| B7 confirm the HTTP status of each error code | Registry in §0.8 | Still check once per phase against the live backend |
| B8 server-side section order | §3.2 says the server is the source of truth | Close once verified live |

### 4.2 Plan items the contract now answers

- **F4.4:** grade history is always in `AnswerReview.history` (§10.1), so drop "if returned".
- **F6.5:** every ranking response has `generatedAt`. Show that time instead of the fixed "within the last 5 minutes".
- **F7.2:** use `resetsAt` from `/solo/usage`; don't assume "1 Nov".
- **F3.6:** the countdown should use `serverTime` (§9.3) to correct for a wrong device clock.
- **§3.6 catalogue:** the contract adds codes the plan doesn't list: `COLLEGE_CODE_ALREADY_EXISTS`, `LOGIN_ID_ALREADY_EXISTS`, `SUBJECT_CODE_ALREADY_EXISTS` (all inline on the field).

### 4.3 `Lexly-UI-Spec.md` disagrees with the plan

I wrote the spec before I had this plan. The plan wins on all of these, and the spec was revised to match (its changelog lists the changes). The spec also added two small things the plan didn't cover: a Library sub-nav (Bare Acts · Case Laws · Search) and a Content sub-nav (Acts · Case laws · Import). The plan's F0.3 now mentions both.

| Topic | Spec says | Plan says |
|---|---|---|
| SUPERADMIN routes | `/superadmin/colleges…` | `/admin/colleges…`, home `/admin` |
| C_STUDENT home | `/dashboard` | `/student` |
| Audit route | `/audit` for both roles | `/admin/audit` and `/college/audit` |
| Nav per role | Home / Bare Acts / Case Laws / Profile for college roles | Role areas + "Library" (e.g. C_STUDENT: Assessments · Library) |
| `/practice` in F0 | Delete the route; Case Laws takes the tab | Keep it as "Solo practice — coming soon" |
| Home progress cards | Delete them | Hide them; revisit after F8 (D3) |
| Bulk import | P0.3 | F1.9 |
| College detail | One page with sections | Tabs (Admins, Assessments, AI usage) |
| `COLLEGE_INACTIVE` and `RATE_LIMITED` copy | Banner; own wording | Different wording; `RATE_LIMITED` as a toast |
| Content admin for acts and sections (F1.7, F1.8) | Not covered | In F1 |

### 4.4 Housekeeping

- **Fixed: progress file.** `docs/progress/frontend_progress.md` had been deleted from the working tree. It was restored from git, because plan §10 makes it the record of every task. Its stale **Next Up** ("Upgrade to Pro", the MCQ Practice flow, `HOME_DASHBOARD_API_CONTRACT.md`) was replaced with the plan's task IDs.
- **Fixed: dead references.** The code comments in `src/api/search.ts`, `src/api/users.ts`, `src/config/features.ts` and `.env.example` pointed at the deleted `HOME_DASHBOARD_API_CONTRACT.md`. They now cite `Lexly-API-Contract.md` §15. These are comment-only changes.
- **Fixed: duplicate contract.** `Lexly-API-Contract_backend.md` was byte-identical to `Lexly-API-Contract.md` and was deleted. The backend repo's copy is the master (contract change process); re-copy it into `docs/Lexly-API-Contract.md` whenever it changes.
- **Branching:** the plan says never commit directly to `main`, but the repo's main branch is `master` and recent commits are on it. This sync is on `docs/sync-frontend-plan`. Use `feature/f0-cleanup` for F0.

---

## 5. Feature plan by phase

Order and dependencies, starting from today. Each frontend phase ships only after its backend phase is merged (plan §4). Before that it can be built against MSW mocks of the contract.

### Now — no backend dependency

**Branch `feature/f0-cleanup`**

| Step | Tasks | Done when |
|---|---|---|
| 1 | F0.1 remove MCQ practice + rewrite Next Up · F0.4 move shared components | No MCQ practice code left except the "coming soon" page; no behaviour change |
| 2 | F0.2 role from `/users/me` · F0.3 role skeleton (`roles.ts`, `RequireRole`, nav from config, NotFound, lazy areas; the five P1 roles only, no legacy mapping) · F1.2 forced password change, pulled forward | A `SUPERADMIN` sees an admin nav without going through Profile, and the seeded account can sign in, change its password and use the app |
| 3 | F0.5 client: `FormData`, `patch`, `upload`, `download`, `AbortSignal`, `errors.ts` | Unit tests for each |
| 4 | F0.6 Vitest, Testing Library, MSW, Playwright, axe, CI workflow | `npm test` runs in CI |
| 5 | F0.7 cookie checks against the live backend; fix G10 | Results recorded in the progress file |

**In parallel (endpoints LIVE)**
- F1.7 acts and sections admin.
- F1.8 case-law ↔ section linking.

**Docs**
- Done: `Lexly-UI-Spec.md` revised to match the plan, with F1.7 and F1.8 added.
- Done: progress file restored and Next Up rewritten (§4.4).

### F1 — backend Phase 0 and Phase 1 done

- **Build now against a local backend on `feature/phase1`:** F1.2 forced password change first (with F0.2/F0.3), then F1.1 two-mode login, F1.4 role areas, F1.5 Profile, F1.6 colleges + C_ADMINs, F1.10 audit log, F1.7–F1.9 content admin (F1.9 builds `ImportResultTable` and `DataTable`), F1.11 tests.
- **Ship** after `feature/phase1` is merged to backend `main`.
- **Dev login:** the seeded SUPERADMIN is `superadmin@lexly.local` / `lexly-superadmin-dev` (backend `.env.example`; dev only), forced to change the password on first sign-in.
- **Done when:** the plan's F1 scenario passes. SUPERADMIN signs in and is forced to change the password, creates a college and a C_ADMIN, the C_ADMIN signs in, and an import with 3 bad rows shows them.

### F2 — College administration (backend Phase 2)

- **Order:** F2.1 React Query (migrate the F1 lists) → F2.2/F2.3 users → F2.4/F2.5 reset and remove → F2.6 bulk import (adds `FileDropzone`; reuses `ImportResultTable` with `CONVERTED`) → F2.7/F2.8 subjects → F2.9 tests.
- **Decision needed first:** D7, the CSV/XLSX templates.

### F3 — Assessments & answering (backend Phase 3)

- **Order:** shared inputs (`StatusBadge`, `DateTimeField`, `MarksInput`, countdown, `PdfViewer`) → professor F3.1–F3.4 → student F3.5–F3.7 (mobile-first) → F3.8 submissions grid → F3.9 SUPERADMIN read-only → F3.10 tests.
- **Decisions needed first:** D5 / O4, the upload limits.
- **UI spec needed first:** the student answer cards and the submissions grid.

### F4 — Manual grading & results (backend Phase 4)

- **Order:** F4.1/F4.2 answer review + grade panel → F4.3 next/previous flow → F4.4 history → F4.5 count refresh → F4.6 student results → F4.7 tests.
- **UI spec needed first:** the professor review screen. A reference design would help most here.

### F5 — AI evaluation UI (backend Phase 5) and F6 — Rankings & statistics (backend Phase 6)

These can run in parallel.
- **F5:** button gating → polling → AI suggestion with flag chips → failure and retry → grid statuses and the AI usage tab.
- **F6:** `RankingTable` + subject picker → C_ADMIN overview → per-student view → freshness from `generatedAt`.

### F7 — Solo AI practice (backend Phase 7)

- **Order:** plan gate + usage meter → generate question → attempts with polling → generated answers → history → SUPERADMIN subjects and plans → Home Practice card → tests.

### F8 — Payments & hardening (backend Phase 8)

- **F8.1 checkout:** waits for the payment addendum (D8).
- **F8.2–F8.7:** accessibility, performance budget, dark theme (D4), CSP, monitoring (D9) and the E2E matrix. These need nothing new from the backend and can be pulled earlier.

### Decisions to settle (plan §7) and when

| Decision | Needed before |
|---|---|
| D1 TanStack Query | F2 (recommended yes) |
| D3 Home progress cards and unified search | F0.1 (plan says hide) |
| D5 upload limits / O4 | F3 |
| D6 production domains (same-site for the refresh cookie) | Before the first deploy |
| D7 import templates | F2 |
| D4 dark mode, D8 payment UX, D9 monitoring | F8 |
