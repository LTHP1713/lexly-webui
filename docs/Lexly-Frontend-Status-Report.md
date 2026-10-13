# Lexly Frontend — Status Report

**Date:** 2026-10-13
**Repo state:** `master` at `fab9df4` ("bare act & case laws"). The doc sync is on branch `docs/sync-frontend-plan`.
**Compared against:** `Lexly-Frontend-Implementation-Plan.md` (revised 2026-10-13) and `Lexly-API-Contract.md` (identical to the backend repo's copy on 2026-10-13).
**Method:** I checked each plan task against the code, `package.json` and `docs/progress/frontend_progress.md`. I did not run the app or the backend for this report.
**Update, same day:** the doc findings in §4 have been applied. The plan and `Lexly-UI-Spec.md` now agree, and the stale references to the deleted Home contract in the code comments and `.env.example` are fixed. The progress file was restored and its Next Up rewritten from this plan; see §4.4.

---

## 1. Summary

- **Done:** everything the plan lists as "built and working" (§1.1). That covers the reading app (Bare Acts, Case Laws, search, Home), email login and register with the cookie session, the case-law admin, and the free/Pro removal. The code matches the plan's description.
- **Not started:** every plan task, F0.1 through F8.7. F0 (clean-up and foundations) has no backend dependency and can start now.
- **Blocked on the backend:** F1–F8. The contract labels backend Phases 0–8 **PROPOSED**; none of them are agreed or merged yet. Only the LIVE endpoints (auth, `/users/me`, content reads, content admin) can be used for real today.
- **Can start now besides F0:**
  - **F1.7, acts and sections admin.** The `/admin/acts`, `/admin/sections` and per-item endpoints are LIVE.
  - **F1.8, case-law ↔ section linking.** The link and unlink endpoints are LIVE.
- **Docs:** the UI spec, the plan and the contract are now in sync (§4). The UI spec covers F0 and F1, including F1.7 and F1.8. The progress file was restored and its Next Up rewritten (§4.4).

| Phase | Tasks | Done | Can start now | Blocked by backend |
|---|---|---|---|---|
| F0 Clean-up & foundations | 7 | 0 | 7 | — |
| F1 Identity, roles, SUPERADMIN, content admin | 11 | 0 | 2 (F1.7, F1.8); F1.9 against mocks | Phase 1 (and Phase 0 for F1.9) |
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

**Still open from that work:**
- The 2026-10-09 cookie checks were run against a mock, not the live backend. This is F0.7.
- G10: navigating away while `/auth/refresh` is in flight can sign the user out. Also F0.7.

---

## 3. Yet to be done, task by task

**Status key:** *Not started* = no code for it; *Partial* = some of it exists; *Ready* = can start now; *Blocked* = waits for a backend phase.

### F0 — Clean-up & foundations (no backend dependency)

| # | Task | Status | What the code shows today |
|---|---|---|---|
| F0.1 | Remove MCQ practice | Not started · Ready | `PracticeProgress`, the `practiceStats` flag, its DTOs in `users.ts` and its mocks all still exist; 15 files under `src/` still mention practice (the auth screens' "practice" copy can stay, since solo practice is coming). The doc part is done: `HOME_DASHBOARD_API_CONTRACT.md` is deleted, its references are repointed, and Next Up is rewritten (§4.4) |
| F0.2 | Role from `/users/me` | Not started · Ready | `AuthContext` still sets `role` from `roleFromAccessToken()` after login and register |
| F0.3 | Role skeleton | Not started · Ready | No `roles.ts` or `RequireRole`; no `React.lazy`; `*` redirects to `/login` (no NotFound page); `RedirectIfAuthenticated` always goes to `/dashboard` |
| F0.4 | Shared components to `src/components/` | Not started · Ready | They are all still in `src/pages/admin/` |
| F0.5 | Client extensions | Not started · Ready | `client.ts` sets `Content-Type: application/json` on every body. No `patch`, `upload`, `download` or `AbortSignal`. No `src/api/errors.ts` |
| F0.6 | Tests & CI | Not started · Ready | No Vitest, Testing Library, MSW, Playwright or axe in `package.json`; no `test` script; no `e2e/`; no `.github/workflows` |
| F0.7 | Session edge cases | Not started · Ready | Listed in Next Up; G10 not fixed |

### F1 — Identity, roles, SUPERADMIN & content admin (backend Phase 1)

| # | Task | Status | Notes |
|---|---|---|---|
| F1.1 | Two-mode login | Blocked (P1) | Login is email-only today. Can be built against MSW mocks of contract §1.2 |
| F1.2 | Forced password change | Blocked (P1) | Needs `POST /auth/change-password` (§1.5) and the `PASSWORD_CHANGE_REQUIRED` gate (§1.6) |
| F1.3 | Registration | Nothing to do | Unchanged; the backend makes the role `S_STUDENT` |
| F1.4 | Role areas live | Blocked (P1) | Needs F0.3 first |
| F1.5 | Profile | Partial · Blocked (P1) | Shows email and log out. College, role and change password need the P1 `/users/me` fields |
| F1.6 | Colleges + C_ADMIN accounts | Blocked (P1) | Contract §6 |
| F1.7 | Acts & sections admin | Not started · **Ready** | Endpoints LIVE (§5.1–5.3). `GET /admin/acts/{id}` and `GET /admin/sections/{id}` are only ADDED (P1). Until then the editor can load from the public `GET /sections/{id}`, but it can't show an act's `description` |
| F1.8 | Case-law ↔ section linking | Partial · **Ready** | The form shows linked sections read-only (`AdminCaseLawFormPage.tsx:293`). The link/unlink endpoints are LIVE (§5.4) |
| F1.9 | Bulk JSON import | Not started · Blocked (P0) | The endpoints are LIVE, but backend Phase 0 changes the response to per-row results. Build against the P0 shape with mocks |
| F1.10 | Audit log | Blocked (P1) | Contract §7 |
| F1.11 | Tests | Blocked | Needs F0.6 |

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
| `ConfirmDialog`, `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard` | Exist; move in F0.4 | — |
| `StudyPanel`, `LoadingState`, `ErrorState` | Exist | — |
| `RequireRole`, role nav config, `NotFound` | Missing | F0 |
| `DataTable`, `Pagination`, `ImportResultTable` | Missing | F1 |
| `FileDropzone` | Missing | F2 |
| `StatusBadge`, `DateTimeField`, countdown, `MarksInput`, `PdfViewer` | Missing | F3 |
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
| 2 | F0.2 role from `/users/me` · F0.3 role skeleton (`roles.ts`, `RequireRole`, nav from config, NotFound, lazy areas; `ADMIN` → SUPERADMIN area, `STUDENT`/`LAWYER` → S_STUDENT) | An `ADMIN` sees an admin nav without going through Profile |
| 3 | F0.5 client: `FormData`, `patch`, `upload`, `download`, `AbortSignal`, `errors.ts` | Unit tests for each |
| 4 | F0.6 Vitest, Testing Library, MSW, Playwright, axe, CI workflow | `npm test` runs in CI |
| 5 | F0.7 cookie checks against the live backend; fix G10 | Results recorded in the progress file |

**In parallel (endpoints LIVE)**
- F1.7 acts and sections admin.
- F1.8 case-law ↔ section linking.

**Docs**
- Done: `Lexly-UI-Spec.md` revised to match the plan, with F1.7 and F1.8 added.
- Done: progress file restored and Next Up rewritten (§4.4).

### F1 — after backend Phase 0 and Phase 1 are agreed

- **Start against mocks once the contract is agreed:** F1.1 two-mode login, F1.2 forced password change, F1.9 bulk import (P0 shape, which builds `ImportResultTable` and `DataTable`).
- **After Phase 1 merges:** F1.4 role areas (drop the legacy mapping), F1.5 Profile, F1.6 colleges + C_ADMINs, F1.10 audit log, F1.11 tests.
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
