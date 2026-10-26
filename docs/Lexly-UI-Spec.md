# Lexly — UI Spec (web)

**Status:** Draft, revised 2026-10-26. F0–F4 written and synced with backend Phases 0–4 (contract §1, §2, §5–§10 LIVE); F5a written against backend Phase 5a (contract §11a); F5b and F5c written against backend Phases 5b and 5c (contract §11b, §11c LIVE); F5 on hold; F8a, F6a and later not yet written.
**Audience:** frontend developers on `lexly-webui`, plus backend and design reviewers.
**Companion docs:**
- [`Lexly-Frontend-Implementation-Plan.md`](Lexly-Frontend-Implementation-Plan.md) says **which** screens each phase builds. Task IDs (F1.6 …) come from there.
- [`Lexly-API-Contract.md`](Lexly-API-Contract.md) defines the field names and error codes. It is a copy of the backend repo's contract, which is the master.
- [`Lexly-Frontend-Status-Report.md`](Lexly-Frontend-Status-Report.md) says what is built.

This document says **what each screen looks like and how it behaves**: its purpose, its layout on desktop and mobile, the data it shows (down to the contract field), its actions, every state, and the exact copy for dialogs and errors. If a screen and this spec disagree, fix one of them in the same PR. If this spec and the plan disagree on scope or routes, the plan wins and this spec is corrected.

### How this document grows

- Each phase's section is written and reviewed **before** that phase's frontend work starts, at the same time as the contract sign-off for that phase.
- A phase section is done when every screen task in the plan's table for that phase has an entry here.
- Later changes: edit the section and add a line to the [Changelog](#changelog).

### Design references

No Figma file or reference designs exist yet. When they do, link them here and from the matching screen.

| Area | Link | Notes |
|---|---|---|
| Visual language (palette, type, cards) | Built screens: `/dashboard`, `/sections/:id`, `/caselaws/:id`, `/admin/caselaws/:id/content` | Tokens in `src/index.css` (`--lx-*`) |
| Student assessment and answer cards (F3.6) | — | None made; F3.6 below is the reference until a design exists |
| Professor answer review (F4.1, F4.2) | — | Needed before F4 |

---

## Contents

- [0. Shared conventions](#0-shared-conventions)
- [Phase index](#phase-index)
- [F0 — Clean-up & foundations](#f0--clean-up--foundations)
- [F1 — Identity, roles, SUPERADMIN & content admin](#f1--identity-roles-superadmin--content-admin)
- [F2 — College administration](#f2--college-administration)
- [F3 — Assessments & answering](#f3--assessments--answering)
- [F4 — Manual grading & student results](#f4--manual-grading--student-results)
- [F5a — AI legal tutor](#f5a--ai-legal-tutor)
- [UR — UI refresh](#ur--ui-refresh)
- [F5b — Vocab & Maxims](#f5b--vocab--maxims)
- [F5c — Subject notes](#f5c--subject-notes)
- [F5–F8 (not yet written)](#f5f8-not-yet-written)
- [Open questions](#open-questions)
- [Changelog](#changelog)

---

## 0. Shared conventions

These rules apply to every screen. Phase sections only list what differs.

### 0.1 Breakpoints

| Name | Width | Notes |
|---|---|---|
| Phone | < 768px | Bottom tab bar. Single column. Tables become card lists. 16px side gutter |
| Tablet | 768–1023px | Header nav, no tab bar. Admin and professor tables keep their columns and scroll sideways inside their own wrapper (plan §3.7); the page itself never does |
| Desktop | ≥ 1024px | Header nav. Wide layout (72rem) for lists, grids, admin and the Library study screens; reading column (≈ 44rem) for forms and simple pages |

Student screens are designed phone-first (students upload from phones). Admin and professor screens are designed desktop-first but must work on a phone.

### 0.2 Page templates

| Template | Used for | Layout |
|---|---|---|
| **List** | Colleges, users, subjects, acts, assessments, audit | Title row (H1 + primary action on the right; on phones the action goes full-width below the title) → filter bar → results (`DataTable` from 768px, cards on phones) → `Pagination` |
| **Detail** | College, act, subject, assessment | Breadcrumb → header (title, status badge, key facts, actions) → tabs or sections as cards |
| **Form** | Create/edit too big for a dialog | Field groups with headings, error summary at the top after a failed save, save bar at the bottom (sticky on phones) |
| **Dialog** | Short create/edit (≤ 4 fields) and every confirmation | Native `<dialog>` (`ConfirmDialog`). On phones it fills the width with 16px margins |
| **Study** | Section and case law reading (Library) | Existing study panel (`StudyPanel.tsx`), unchanged |

### 0.3 States every data screen has

| State | Look | Rule |
|---|---|---|
| Loading | `LoadingState` skeleton in the shape of the content | Never a blank page. Header and title render immediately |
| Error | `ErrorState`: the message from §0.6 + **Try again** | Keeps filters and page so retry reloads the same view |
| Empty (no data) | `EmptyState`: icon, one sentence on what goes here, the primary action if the user can take it | Copy is given per screen |
| Empty (no matches) | "No {things} match these filters." + **Clear filters** | Only when a search or filter is active |
| Not found | `NotFound` page (F0.3) | Also used for out-of-scope ids, which return 404 by design (contract §0.1) |
| Saving | Primary button disabled with a spinner and an "-ing" label ("Saving…") | Double submit is ignored |

Lists keep their filters, search and page in the URL (page 1-based in the URL, 0-based on the wire, plan §1.2), so Back and reload return to the same view.

### 0.4 Formatting

| Value | Format | Example |
|---|---|---|
| Instant | Viewer's local time, `en-IN`, day month year, 12-hour | `13 Oct 2026, 2:45 pm` |
| Instant within 24 h, in lists | Relative, full value in `title` | `5 min ago`, `3 h ago` |
| Date | `en-IN` | `24 Apr 1973` |
| Deadline | Instant + relative suffix while in the future | `2 Nov 2026, 12:00 am · in 3 days` |
| Marks | Up to 1 decimal, no trailing `.0` | `7.5 / 10`, `8 / 10` |
| Percentage | 1 decimal | `71.9%` |
| Counts | `en-IN` grouping | `1,180` |
| Role | Label from §0.7 | `College admin` |

### 0.5 Feedback patterns

- **Toast** (`useToast`) after a successful save, create or delete that keeps the user on the page. Past tense, names the thing: "College added." Also used for `RATE_LIMITED` outside forms (§0.6).
- **Inline field errors** under the input, from client validation first, then from `VALIDATION_ERROR` paths (contract §0.3). Focus moves to the first invalid field.
- **Error summary** at the top of long forms after a failed save, each item linking to its field (existing `contentForm.ts` pattern).
- **Form banner** (`role="alert"`) above the submit button for errors that don't belong to a field.
- **Confirm dialog** before every destructive or irreversible action, and before anything that affects other users' access. Focus starts on **Cancel**. The confirm button repeats the verb ("Deactivate", not "OK").
- **Typed confirmation** (the user types a short code or ID to enable the button) for deletes that cascade to a lot of data: deleting an act (F1.7), removing a user (F2.5).
- **Unsaved changes** (`useUnsavedChangesGuard`) on every form page: "Leave without saving? Your changes will be lost." / **Stay** / **Leave**.

### 0.6 Error code → UI

This expands the plan's §3.6 catalogue with copy. Clients switch on `error`, never on `message`. Screen sections only list codes whose handling differs from this table.

| Code / condition | Where | Copy |
|---|---|---|
| `NETWORK_ERROR` (fetch failed) | Banner or `ErrorState` | Unable to connect. Please check your connection and try again. |
| `VALIDATION_ERROR` with a known path | Field | The server reason, under the field |
| `VALIDATION_ERROR` without a known path | Banner | Please check the details you entered and try again. |
| `UNAUTHORIZED` after the silent refresh fails | Login screen banner | Your session has ended. Please sign in again. |
| `FORBIDDEN` | Full page | You don't have access to this page. + **Go to my home** |
| `NOT_FOUND` on page load | Full page | `NotFound` (F0.3) |
| `NOT_FOUND` on an action | Banner, then reload the list | This item no longer exists. The list has been refreshed. |
| `RATE_LIMITED` | Toast; the form banner on sign-in and change password | Too many requests, try again shortly. No automatic retry. (Raised by the backend from P8; handled from F1) |
| `PASSWORD_CHANGE_REQUIRED` | — | No message. Go to `/change-password` (F1.2) |
| `COLLEGE_INACTIVE` | Login screen banner | Your college's account is inactive. Contact your administrator. |
| `EMAIL_ALREADY_EXISTS` | Field `email` | This email is already used by another Lexly account. |
| `SHORT_CODE_ALREADY_EXISTS` | Field `shortCode` | Another act already uses this short code. |
| `SECTION_NUMBER_ALREADY_EXISTS` | Field `sectionNumber` | This act already has a section with this number. |
| `COLLEGE_CODE_ALREADY_EXISTS` | Field `code` | Another college already uses this code. |
| `LOGIN_ID_ALREADY_EXISTS` | Field `loginId` | Another student or professor at your college already uses this ID. |
| `SUBJECT_CODE_ALREADY_EXISTS` | Field `code` | Another subject at your college already uses this code. |
| `IMPORT_FILE_INVALID` | Under the file input | This file can't be imported: {server message} |
| `SUBJECT_IN_USE` | Delete dialog | See F2.7 (assessments) and F5c.7 (notes) |
| `ASSESSMENT_NOT_EDITABLE` | Banner on the editor or detail, then reload | See F3.2, F3.4 |
| `ASSESSMENT_CLOSED` | Answer card, after a refetch | The due date has passed, so this answer can't be changed. |
| `ANSWER_LOCKED` | Answer card, after a refetch | This answer was already submitted. |
| `INVALID_FILE` | Under the answer card's file input; for notes under the note file field | Answers: This PDF can't be used: {server reason}. Notes: This file can't be used: {server reason} (F5c) |
| `PLAN_REQUIRED` (from P8a) | S_STUDENT, on the gated screen | Until F8a: the generic error. From F8a: `PlanGate` |
| `INVALID_MARKS` | Grade panel, field `finalMarks` | Enter marks from 0 to {maxMarks}, in whole or half marks. |
| `GRADE_PUBLISHED` | Grade panel banner, after a refetch | This grade has already been published, so it can't be changed. |
| `QUOTA_EXCEEDED` (tutor) | Quota banner above the composer; composer disabled; the question kept | You've used today's 10 questions. They reset at midnight India time ({local time of `resetsAt`}). |
| `AI_UNAVAILABLE` | On the pending tutor message, with **Try again** | The tutor couldn't answer just now. Your question wasn't counted. |
| `INDEX_RUN_IN_PROGRESS` | Tutor admin: refetch the runs; a polite note, not an error | A re-index is already running. |
| `INTERNAL_ERROR`, other 5xx | Banner or `ErrorState` | Lexly is having trouble right now. Please try again in a moment. |
| Anything else | Banner | Something went wrong. Please try again. |

### 0.7 Roles

| Role (contract §0.7) | Label | Home (plan §3.2) | Signs in with |
|---|---|---|---|
| `SUPERADMIN` | Super admin | `/admin` | Email |
| `C_ADMIN` | College admin | `/college` | Email |
| `C_PROFESSOR` | Professor | `/professor` | College code + employee ID |
| `C_STUDENT` | Student | `/student` | College code + roll no |
| `S_STUDENT` | Student | `/dashboard` | Email |

These are the only roles. Backend P1 remapped the old `ADMIN` to `SUPERADMIN` and `STUDENT` / `LAWYER` to `S_STUDENT`, so the UI has no legacy mapping. An unrecognised role gets the Library only, with home `/acts`.

### 0.8 Accessibility baseline

- One H1 per page, matching the browser tab title (`{Page} · Lexly`).
- Every table has a caption (visually hidden is fine), `scope` on headers and `aria-sort` on sortable ones. Card versions on phones use a list with the same information order.
- Status badges have text, not only colour.
- Touch targets ≥ 44px on phones.
- Live regions: toasts (`polite`), form banners (`alert`), `RepeatableList` moves (`polite`), polling status (`polite`, F5/F7).

---

## Phase index

| Phase | Theme | Status in this spec | Screens (plan task) |
|---|---|---|---|
| F0 | Clean-up & foundations | **Written** | Solo practice placeholder (F0.1), Home (F0.1), Navigation and NotFound (F0.3) |
| F1 | Identity, roles, SUPERADMIN & content admin | **Written** | Login (F1.1), Change password (F1.2), Role areas (F1.4), Profile (F1.5), Colleges (F1.6), Acts & sections admin (F1.7), Case-law linking (F1.8), Bulk import (F1.9), Audit log (F1.10) |
| F2 | College administration | **Written** | Users list and detail (F2.2), Add/edit user (F2.3), Reset password (F2.4), Remove user (F2.5), Import users (F2.6), Subjects (F2.7), Read-only subjects (F2.8) |
| F3 | Assessments & answering | **Written** | Professor list (F3.1), Draft editor (F3.2), Publish (F3.3), Delete/remove (F3.4), Student list (F3.5), Student assessment (F3.6), Upload (F3.7), Assessment detail and submissions grid (F3.8). F3.9 dropped (A9) |
| F4 | Manual grading & student results | **Written** | Grading counts and grid (F4.5), Answer review (F4.1), Grade panel (F4.2), Grading flow (F4.3), Grade history (F4.4), Student results (F4.6) |
| F5 | AI evaluation UI | On hold (backend Phase 5 on hold) | — |
| F5a | AI legal tutor | **Written** | Tutor (F5a.3), Tutor admin: index and spend (F5a.4) |
| F5b | Vocab & Maxims | **Written** | Vocab and Maxims (F5b.3), Study hub placard and S_STUDENT switch (F5b.2) |
| F5c | Subject notes | **Written** | Nav split (F5c.0), professor notes (F5c.3), student notes (F5c.4), college notes (F5c.5), subject delete and detail (F5c.7), audit summaries (F5c.8) |
| F8a | Trial, plans & billing | Not yet | — |
| F6a | C_ADMIN analytics (Sync) | Not yet | — |
| F6a-2 | Rankings & statistics | Not yet | — |
| F7 | Solo AI practice | Not yet | — |
| F8b | Gateway checkout & hardening | Not yet | — |
| UR | UI refresh | **Written** | Visual language (UR.1), Shell (UR.2), Role homes (UR.3), Screens (UR.4) |

F0.2, F0.4–F0.7, F1.3, F1.11, F2.1, F2.9, F3.10 and F4.7 have no screens of their own.

---

## F0 — Clean-up & foundations

### F0.1 Remove MCQ practice

Nothing in `/practice/**` survives TDD v2 (contract §15). `/practice` stays as the S_STUDENT entry point and becomes Solo practice in F7.

| Where | Change |
|---|---|
| `/practice` (`PracticePage.tsx`) | Becomes the "Solo practice — coming soon" placeholder below |
| Bottom tab bar | Unchanged for S_STUDENT: Home · Bare Acts · Practice · Profile |
| Home quick actions | **Practice** stays; its description changes from "Practice MCQs" to "Solo practice, coming soon" |
| Home `PracticeProgress` card | Deleted, with the `practiceStats` flag, its DTOs and its mocks |

**Solo practice placeholder** (`SimplePage` style, reading column):
- H1 "Practice"
- Panel title: "Solo practice is coming soon"
- Text: "You'll get exam-style questions on the subjects you choose, upload your handwritten answers and get marks and feedback on each attempt."
- Text: "Until then, keep reading:" + **Browse Bare Acts** (primary) · **Study Case Laws**

### F0.1 Home (S_STUDENT, `/dashboard`)

**Purpose:** starting point for reading: search, then jump into Acts, Case Laws or Practice.

| Region | Desktop | Phone |
|---|---|---|
| Hero | Date, greeting with `firstName` (`GET /users/me`), "What do you want to learn today?", Universal Search | Same, stacked |
| Quick actions | Three cards in a row: Bare Acts, Case Laws, Practice | Three cards stacked |

The Bare-Act Progress and Continue Learning cards depend on endpoints that aren't in TDD v2. Per decision D3 they are **hidden** (not rendered at all) while their flag is off, instead of showing "not tracked yet". The code stays so they can come back after F8. Universal Search keeps its client-side fan-out (`unifiedSearch` off).

States: the greeting falls back to "Hi!" while `/users/me` loads or fails; Home never shows an error for it. Search has its own states (unchanged).

F7.8 adds a Practice card where Practice Progress used to be.

### F0.3 Navigation and NotFound

**Role-driven nav.** `AppLayout` renders the nav items from `src/auth/roles.ts`. From 768px they sit in the header (current item underlined, `aria-current="page"`); below 768px they form the bottom tab bar. The header always keeps: brand → role home, greeting, notifications, profile avatar (→ `/profile`). Max 5 items per role.

| Role | Nav items (plan §3.2) | Shown from |
|---|---|---|
| `SUPERADMIN` | Colleges · Content · Solo · Audit · Library | F0: Content · Library. F1: + Colleges, Audit. F7: + Solo |
| `C_ADMIN` | Users · Subjects · Statistics · Audit · Library | F1: Audit · Library. F2: + Users, Subjects. F6: + Statistics |
| `C_PROFESSOR` | Assessments · Rankings · Library | F1: Library. F3: + Assessments. F6: + Rankings |
| `C_STUDENT` | Assessments · Library | F1: Library. F3: + Assessments |
| `S_STUDENT` | Home · Bare Acts · Practice · Profile | F0 (as today) |

A nav item is never shown before its screens exist.

**Library** is the shared read-only content: `/acts`, `/acts/:actId`, `/sections/:id`, `/search`, `/caselaws`, `/caselaws/:id`. The Library nav item goes to `/acts` and is active on all of these routes. For roles that have a Library item (all except S_STUDENT), the Library list pages (`/acts`, `/caselaws`, `/search`) show a sub-nav under the H1: **Bare Acts · Case Laws · Search**. S_STUDENT reaches the same pages through Home and the tab bar, as today, and sees no sub-nav.

**Content** (SUPERADMIN) goes to `/admin/acts` and is active on `/admin/acts/**`, `/admin/sections/**`, `/admin/caselaws/**` and `/admin/import`. Those pages show a sub-nav: **Acts · Case laws · Import**.

**Role homes in F0.** `/admin` (SUPERADMIN) redirects to `/admin/acts` until F1.4 gives it a hub. Other roles keep `/dashboard`.

**Wrong-role URLs.** A signed-in user who opens another role's route is redirected to their own home, with no message (plan §3.2).

**NotFound page** (replaces the `*` → `/login` redirect): inside the app shell when signed in, inside `AuthLayout` when signed out.
- H1 "Page not found"
- Text: "This page doesn't exist, or you don't have access to it."
- Button: **Go to my home** (signed in) / **Sign in** (signed out)

---

## F1 — Identity, roles, SUPERADMIN & content admin

Contract: §0.7, §0.8, §1, §2, §5, §6, §7.

### Session and routing rules (F1.2, F1.4)

| Event | Behaviour |
|---|---|
| Sign-in success | Fetch `GET /users/me` (F0.2). If `mustChangePassword` → `/change-password`. Else → the `from` location if the role may open it, else the role's home (§0.7) |
| `/login` or `/register` while signed in | The role's home |
| Any response `403 PASSWORD_CHANGE_REQUIRED`, or any route while `mustChangePassword` | `/change-password` |
| Refresh returns `403 COLLEGE_INACTIVE` | Clear the session, go to `/login` with the §0.6 banner |
| Refresh returns `401` | Clear the session, go to `/login` with "Your session has ended. Please sign in again." Not shown after a deliberate logout |
| `/` | Signed in → role home. Signed out → `/login` |

Content admin routes (`/admin/**`) accept `SUPERADMIN` only.

The gate is read from the access token (contract §1.6). After a successful change the client must switch to the access token from the change-password response; the old one stays gated until it expires.

### F1.1 Login

**Purpose:** one sign-in screen for email accounts and college accounts.
**Route:** `/login`, inside the existing `AuthLayout` (illustration beside the form from 1024px; hidden on phones).

**Layout**
1. H1 "Welcome back", subtitle "Continue your legal learning journey."
2. **Tabs** (`role="tablist"`): **Email** · **College**. The last-used tab name is remembered in `localStorage` (never credentials). Default: Email.
3. The tab's fields (below).
4. Banner region, then **Sign In** ("Signing in…").
5. Under the form, Email tab: "New to Lexly? **Create an account**". College tab: "Don't have your login details? Ask your college administrator."

| Tab | Field | Label | Input details | Client check |
|---|---|---|---|---|
| Email | `email` | Email | `type=email`, autocomplete `username` | Required, valid email |
| Email | `password` | Password | Show/hide toggle | Required |
| College | `collegeCode` | College code | Upper-cased as typed, `autocapitalize=characters`, placeholder `e.g. NLSIU` | Required |
| College | `loginId` | Roll no. or employee ID | Trimmed, case kept | Required |
| College | `password` | Password | Show/hide toggle. Hint: "First time? Your password is your roll no. or employee ID." | Required |

Switching tabs keeps the password and clears field errors.

**Errors.** Every credential failure gets one generic message (contract §1.2 returns the same 401 for all of them):

| Response | Banner copy |
|---|---|
| `401`, Email tab | Incorrect email or password. |
| `401`, College tab | Incorrect college code, ID or password. |
| `403 COLLEGE_INACTIVE` | Your college's account is inactive. Contact your administrator. |
| `429 RATE_LIMITED` | Too many requests, try again shortly. |

### F1.2 Change password

**Route:** `/change-password`, for both cases:

| Case | Frame | Way out |
|---|---|---|
| Forced (`mustChangePassword`) | App shell with every nav item hidden; the header shows only the brand and **Log out** | Log out |
| Voluntary (from Profile) | Normal app shell, reading column, breadcrumb "Profile / Change password" | **Cancel** → `/profile` |

**Copy.** Forced: H1 "Set a new password", subtitle "For your security, choose a new password before you continue." Voluntary: H1 "Change password", no subtitle.

| Field | Label | Client check |
|---|---|---|
| `currentPassword` | Current password | Required. Forced hint: "This is the password you just signed in with." |
| `newPassword` | New password | ≥ 8 chars; ≠ current ("Choose a password different from your current one."); ≠ `loginId` when the user has one ("Don't use your roll no. or employee ID as your password.") |
| `confirmPassword` (client only) | Confirm new password | Equals new ("Passwords don't match.") |

Button **Save password** ("Saving…").

**Server errors** (contract §1.5, all `400 VALIDATION_ERROR`):

| Server message | Field | Copy |
|---|---|---|
| `currentPassword: is incorrect` | Current password | Your current password is incorrect. |
| `newPassword: must be different from the current password` | New password | Choose a password different from your current one. |
| `newPassword: must not be your login ID` | New password | Don't use your roll no. or employee ID as your password. |
| `newPassword: must be at least 8 characters` | New password | Use at least 8 characters. |

Other paths → under their field. `RATE_LIMITED` → form banner.

**Success:** take the new access token (the server rotates the cookie), refetch `/users/me`, then:
- Forced → role home, toast "Password updated."
- Voluntary → `/profile`, toast "Password updated. You've been signed out on other devices."

### F1.4 Role areas and homes

| Role | Home in F1 |
|---|---|
| `SUPERADMIN` | `/admin` hub: three link cards — **Colleges** ("Add colleges and their admins"), **Content** ("Acts, sections, case laws and imports"), **Audit log** ("Who did what, last 30 days"). F7 adds **Solo practice** |
| `C_ADMIN` | `/college` placeholder: "{college.name} ({college.code})" and "User and subject management is coming soon." F6.3 replaces it with the overview |
| `C_PROFESSOR` | `/professor` placeholder: "Assessments are coming soon. Meanwhile, the Library is open to you." + **Open the Library** |
| `C_STUDENT` | `/student` placeholder: "Your assessments will appear here. Meanwhile, the Library is open to you." + **Open the Library** |
| `S_STUDENT` | `/dashboard` (F0.1) |

Placeholders use the `SimplePage` panel style.

### F1.5 Profile

**Route:** `/profile`, every role. Reading column. Data: `GET /users/me`.

| Row | Field | Shown for |
|---|---|---|
| Name | `fullName` | All |
| Email | `email` | All |
| Role | §0.7 label of `role` | All |
| College | `college.name` (`college.code`) | C_* roles |
| Roll no. / Employee ID | `loginId` (label by role) | `C_STUDENT` / `C_PROFESSOR` |

Actions: **Change password** → `/change-password`; **Log out**. The "Admin: manage case laws" link is removed (the admin area has its own nav).

States: skeleton rows while loading; on error, the email from the session and an `ErrorState` under it.

### F1.6 Colleges (SUPERADMIN)

#### Colleges list — `/admin/colleges`

**Purpose:** find a college, see its size and status, add one. Data: `GET /superadmin/colleges` (contract §6.1). Template: List.

**Filter bar:** search (`q`, "Search by name or code", debounced 300 ms) · Status: All / Active / Inactive (`active`) · Sort: Name (A–Z) / Code / Newest (`name,asc` / `code,asc` / `createdAt,desc`).

| Column | Field | Notes |
|---|---|---|
| College | `name`, with `code` below in muted monospace | The row links to the detail |
| Status | `active` | Badge "Active" / "Inactive" |
| Admins | `counts.admins` | "None" in the warning colour at 0: nobody can manage that college |
| Professors | `counts.professors` | |
| Students | `counts.students` | |
| Added | `createdAt` | Date only |

**Phone cards:** name + status badge; code; "{admins} admins · {professors} professors · {students} students".

**Action:** **Add college** (primary) → dialog below.

| State | Copy |
|---|---|
| Empty | "No colleges yet. Add the first college to give its students and professors access." + **Add college** |
| No matches | "No colleges match these filters." + **Clear filters** |

#### Add college (dialog)

| Field | Label | Details |
|---|---|---|
| `code` | College code | Upper-cased, monospace. Hint: "Students and professors type this when they sign in. It can't be changed later." Client: 2–20 letters or digits ("Use 2–20 letters or digits, no spaces.") |
| `name` | College name | Required, ≤ 255 |

Buttons **Cancel** · **Add college** ("Adding…"). Success → the new college's detail page, toast "College added. Next, add a college admin."

#### College detail — `/admin/colleges/:id`

Data: `GET /superadmin/colleges/{id}`. Template: Detail with tabs.

**Header:** breadcrumb "Colleges / {code}"; H1 `name`; code chip; status badge; "Added {createdAt}". Actions (stacked under the title on phones): **Edit name** · **Deactivate** (or **Activate**). Stat tiles: Admins, Professors, Students (`counts`).

When inactive, a notice under the header: "This college is inactive. Its users can't sign in."

**Tabs** (URL `?tab=`): **Admins** (F1) · **AI usage** (F5.5). (The Assessments tab, F3.9, was dropped on 2026-10-15: SUPERADMIN has no view of college assessments.) Only tabs whose phase has shipped are shown. A link "Audit log for this college" → `/admin/audit?collegeId={id}`.

**Edit name (dialog):** one field, College name. Under the title: "Code {code} stays the same." Toast "College name updated."

**Deactivate (confirm)**
- Title: Deactivate {name}?
- Body: "Everyone at this college — admins, professors and students — loses access. They'll be signed out within 15 minutes and can't sign in until you activate the college again. Their data is kept."
- Buttons: **Cancel** · **Deactivate** (destructive). Toast "{name} deactivated."

**Activate (confirm)**
- Title: Activate {name}?
- Body: "Admins, professors and students of this college will be able to sign in again."
- Buttons: **Cancel** · **Activate**. Toast "{name} activated."

#### Admins tab

Data: `GET /superadmin/colleges/{id}/admins` (`UserSummary[]`, by name).

Each row: `fullName`; `email`; badge "Must change password" when `mustChangePassword`; "Added {createdAt}"; menu (⋯): **Reset password** · **Remove**. Tab action: **Add admin**.

Empty: "This college has no admin yet. Add one so they can set up users and subjects." + **Add admin**.

**Add admin (dialog)**

| Field | Label | Details |
|---|---|---|
| `fullName` | Full name | Required |
| `email` | Email | Required, valid. Hint: "They sign in with this email." |
| `temporaryPassword` | Temporary password | ≥ 8 chars. **Generate** fills and shows a random 12-character password. Hint: "They'll be asked to change it when they first sign in." |

On success the dialog switches to a **share** step, the only time the password is shown:
- Title: Admin added
- Body: "Send these details to {fullName} through a channel you trust. The password won't be shown again." Then a read-only block — Sign-in page `{origin}/login` · Email `{email}` · Temporary password `{password}` — with **Copy details**.
- Button: **Done**.

**Reset password (dialog)**
- Title: Reset password for {fullName}?
- Body: "They'll be signed out everywhere and must set a new password the next time they sign in." Then the Temporary password field with **Generate**.
- Buttons: **Cancel** · **Reset password**. Success: the share step, titled "Password reset".

**Remove admin (confirm)**
- Title: Remove {fullName}?
- Body: "They'll lose access to {college name} immediately. This can't be undone; you can add them again later as a new admin." If they're the only admin, add: "This is the college's only admin. Until you add another, nobody can manage its users or subjects."
- Buttons: **Cancel** · **Remove** (destructive). Toast "{fullName} removed."

### F1.7 Acts & sections admin (SUPERADMIN)

Contract §5.1–§5.2. All three screens show the Content sub-nav (F0.3).

#### Acts list — `/admin/acts`

Data: `GET /acts` (plain array, by title). No server paging; client-side filter box "Filter by title or short code".

| Column | Field |
|---|---|
| Act | `title` (links to `/admin/acts/:actId`) |
| Short code | `shortCode`, monospace |
| | Menu (⋯): **Edit** · **View as reader** (`/acts/:actId`) · **Delete** |

Phone cards: title, short code, menu.

**Add act / Edit act (dialog)**

| Field | Label | Rules |
|---|---|---|
| `title` | Title | Required, ≤ 255 |
| `shortCode` | Short code | ≤ 50, upper-cased. Hint: "Used in imports to refer to this act, e.g. ICA." |
| `description` | Description | Optional, textarea |

Edit loads `GET /admin/acts/{id}` (contract: ADDED, LIVE since P1) because `GET /acts` has no `description` and `PUT` replaces it. Toasts: "Act added." / "Act updated."

**Delete act (typed confirm)**
- Title: Delete {title}?
- Body: "All of its sections are deleted too, with their illustrations, exceptions and links to case laws. This can't be undone." Then "Type **{shortCode}** to confirm" and an input.
- Buttons: **Cancel** · **Delete act** (destructive, enabled when the text matches). Toast "{title} deleted."

Empty: "No acts yet. Add one, or import a batch." + **Add act** · **Import**.

#### Act detail — `/admin/acts/:actId`

Data: `GET /acts/{actId}/sections` (natural order) and the act from `GET /acts`.

**Header:** breadcrumb "Acts / {shortCode}"; H1 `title`; actions **Edit act** · **View as reader**.

**Sections list** (in the server's order; no re-sorting UI):

| Column | Field |
|---|---|
| Section | `sectionNumber` |
| Title | `title` (links to `/admin/sections/:id`) |
| | Menu: **Edit** · **View as reader** (`/sections/:id`) · **Delete** |

Action: **Add section** → dialog with `sectionNumber` (required, ≤ 20), `title` (≤ 500) and `bodyText` (required, textarea, 8 rows). Success → `/admin/sections/:id`, toast "Section added. Add its study content below."

**Delete section (confirm)**
- Title: Delete section {sectionNumber}?
- Body: "Its illustrations, exceptions and study content are deleted, and case laws linked to it lose the link. This can't be undone."
- Buttons: **Cancel** · **Delete** (destructive). Toast "Section {sectionNumber} deleted."

Empty: "This act has no sections yet." + **Add section** · **Import sections**.

#### Section editor — `/admin/sections/:sectionId`

**Purpose:** edit everything the reader shows for one section.
**Data:** loads `GET /admin/sections/{id}` (ADDED, LIVE since P1), so the editor loads exactly what it `PUT`s. List order is sent as `displayOrder`.
**Save:** one **Save section** sends `PUT /admin/sections/{id}` with the whole `SectionRequest`, nested lists included. The per-item illustration and exception endpoints (§5.3) are not used: `PUT` replaces the nested lists anyway, and one save keeps the "load → save unchanged → identical body" check (F1.11) simple. This matches the case-law content editor.

**Layout:** wide layout. From 1024px a sticky left index of the groups ("On this form") with an error count per group after a failed save; on smaller screens, no index. Breadcrumb "Acts / {shortCode} / Section {sectionNumber}". Header action: **View as reader**.

| Group | Fields (contract §5.2 limits apply) | Editor |
|---|---|---|
| Section | `sectionNumber`, `title`, `bodyText` (textarea, auto-grow, serif) | Fields |
| In simple words | `inSimpleWords` | Textarea, optional |
| Clause by clause | `provisionMeaning[]`: `clause`, `title`, `explanation` | `RepeatableList`, ≤ 100, "Add clause" |
| Illustrations | `illustrations[]`: `text`, `hypothetical` (checkbox "Written by Lexly (hypothetical)"; unchecked = from the Act) | `RepeatableList`, ≤ 50, "Add illustration" |
| Exceptions | `exceptions[]`: `title`, `explanation`, nested `illustrations[]` | `RepeatableList`, ≤ 50; each item has its own nested list, ≤ 50 |
| Key legal terms | `keyLegalTerms[]`: `term`, `definition` | `RepeatableList`, ≤ 100, "Add term" |

Save bar (sticky): **Save section** ("Saving…") and "Unsaved changes" / "All changes saved", as in the case-law forms.

| State / response | Behaviour |
|---|---|
| Loading | Skeleton per group |
| Not found | `NotFound` |
| `409 SECTION_NUMBER_ALREADY_EXISTS` | Field error on Section number (§0.6) |
| `VALIDATION_ERROR` | Paths like `exceptions[2].illustrations[0].text` map to that row; error summary at the top |
| Saved | Toast "Section saved." Stays on the page; the next reader visit bypasses the cache (existing pattern) |
| Leaving with changes | Unsaved-changes guard |

### F1.8 Case-law ↔ section linking

**Where:** the **Linked sections** card on `/admin/caselaws/:id`, which today is a read-only list. On a new, unsaved case law the card says "Save the case law first, then link the sections it interprets."

**List:** each linked section as "{act short code} · Section {sectionNumber} — {title}" with **Unlink** on the right. (`SectionSummary` has no act, so the act label comes from the picker when known; otherwise only "Section {sectionNumber} — {title}".) Empty: "No sections are linked to this case law."

**Link sections (dialog)**
1. **Act** select (`GET /acts`).
2. Filter box "Filter by number or title" over that act's sections (`GET /acts/{actId}/sections`).
3. One row per section with **Link**; rows already linked show "Linked" (disabled).

**Link** calls `POST /admin/caselaws/{id}/sections/{sectionId}` and replaces the list with the response; the dialog stays open for more. **Done** closes it. **Unlink** calls `DELETE …` at once, with no confirm (it is undone by linking again), and shows the toast "Section {sectionNumber} unlinked."

### F1.9 Bulk JSON import — `/admin/import`

**Purpose:** paste or upload a JSON batch of acts, sections or case laws and see, row by row, what was created and what wasn't. Data: contract §5.5, **per-row (Phase 0) shape** only.

**Layout (reading column)**
1. H1 "Import content".
2. **Kind** segmented control: Acts · Sections · Case laws (URL `?kind=`). Under it: "Up to 10 acts per batch." / "Up to 100 sections of one act per batch." / "Up to 10 case laws per batch."
3. **Source:** monospace textarea (min 12 rows) and **Choose .json file**, which loads the file into the textarea (max 1 MB on the client).
4. **Import** (primary).
5. **Results**, after a response.

**Client checks** (no request if they fail): valid JSON → else "This isn't valid JSON: {parser message}". The top-level key matches the kind (`acts`; `actShortCode` + `sections`; `caseLaws`) → else "For {kind}, the JSON needs a top-level \"{key}\" list." Row count within the limit → else "This batch has {n} rows; the limit is {max}."

**Results** (`ImportResultTable`, reused in F2.6)
- Summary: "{created} created · {rejected} rejected · {failed} failed, out of {total}." Counts carry text, not only colour.
- Status filter chips: All · Created · Rejected · Failed, with counts. Default: Rejected + Failed when either is > 0, else All.
- Columns: **Row** (`index + 1`), **Key** (`key`), **Result** (status badge), **Details** (`errors`, one per line; for `CREATED` a link: act → `/admin/acts/{id}`, section → `/admin/sections/{id}`, case law → `/admin/caselaws/{id}`). Phone: one card per row.
- **Download rejected rows** when rejected + failed > 0: a `.json` file in the same envelope holding only those rows from the source, ready to fix and import again. Under the summary: "Created rows are skipped in that file, so importing it again won't duplicate them."

| State | Look |
|---|---|
| Sending | **Import** shows "Importing…"; the textarea is read-only |
| `400` (envelope invalid: empty list, too many rows, a `null` row, missing `actShortCode`, unparseable body) | Banner with the server message; no results |
| Sections batch with an unknown `actShortCode` | Not a `400`: every row comes back `REJECTED` with `actShortCode: no bare act found…`. The summary adds "No act has the short code {code}." |
| All created | Summary in the success colour; toast "{n} items imported." |

### F1.10 Audit log

**Routes:** `/admin/audit` (SUPERADMIN, all colleges) and `/college/audit` (C_ADMIN, own college). Data: `GET /audit` (contract §7). Template: List, wide.

**Filter bar**

| Filter | Param | Notes |
|---|---|---|
| College | `collegeId` | SUPERADMIN only. Searchable select, plus "All colleges" |
| Action | `action` | Select with the labels below. Only contract values are sent (an unknown one is a `400`) |
| From / To | `from`, `to` | Date inputs. Sent as the start of the `from` day and the start of the day **after** `to` (local time), because `to` is exclusive. Default: the last 7 days |

Under the filters, muted: "Entries are kept for 30 days."

**Table (≥ 1024px):** When (`createdAt`) · Who (`actor.fullName` + role label; "System" when `actor` is null) · College (`college.code`; SUPERADMIN only) · Action (label) · Entity (`entityType`, humanised: "User", "Subject"…) · Details (one-line summary).
**Cards (< 1024px):** action label as heading; "{who} · {when}"; college code; summary.

Clicking a row expands it to show `details` as text: a key–value list with humanised keys (`rejected` → "Rejected"), nested values as indented JSON text. Never HTML.

| `action` | Label | Summary (when `details` has the fields) |
|---|---|---|
| `LOGIN_FAILED` | Failed sign-in | `details.identifier`; adds "College inactive" when `details.reason` is `COLLEGE_INACTIVE` |
| `PASSWORD_RESET` / `PASSWORD_CHANGED` | Password reset / Password changed | Reset: "{role label} account" from `details.role`. Changed: "By {actor}" (`details` is empty) |
| `COLLEGE_CREATED` / `COLLEGE_UPDATED` | College added / College updated | `college.code` and `details.name`. Updated also shows "Active" / "Inactive" from `details.active` (the new state; the old one isn't recorded) |
| `USER_CREATED` / `USER_UPDATED` / `USER_REMOVED` | User added / updated / removed | `details.email` and the role label of `details.role` (no name is recorded) |
| `USER_IMPORT` | Users imported | "{created} created, {converted} converted, {rejected} rejected, {failed} failed of {total}" |
| `CONTENT_IMPORT` | Content imported | `details.kind`, then "{created} created, {rejected} rejected, {failed} failed of {total}" |
| `SUBJECT_CREATED` / `_UPDATED` / `_DELETED` | Subject added / updated / deleted | Subject code |
| `SUBJECT_PROFESSORS_CHANGED` | Subject professors changed | Subject code |
| `ASSESSMENT_PUBLISHED` / `ASSESSMENT_REMOVED` | Assessment published / removed | Title |
| `AI_EVALUATION_REQUESTED` | AI evaluation requested | — |
| `GRADE_EDITED` / `GRADE_PUBLISHED` | Grade edited / published | — |
| `SOLO_PLAN_CHANGED` / `SOLO_QUOTA_RESET` | Solo plan changed / Solo quota reset | — |

Unknown actions show the raw code in monospace, so a new backend action never breaks the page. Missing summary fields show "—". Since P1 the backend records only `LOGIN_FAILED`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `COLLEGE_CREATED`, `COLLEGE_UPDATED`, `USER_CREATED`, `USER_REMOVED` and `CONTENT_IMPORT`; the rest appear as their phases ship. `CONTENT_IMPORT` rows have no college, so a SUPERADMIN sees them only under "All colleges".

| State | Copy |
|---|---|
| Empty, default filters | "Nothing has been recorded in the last 7 days." |
| No matches | "No entries match these filters." + **Clear filters** |

---

## F2 — College administration

Contract: §0.4, §0.8, §5.5 (`BulkImportResult`), §7, §8. Everything here is scoped to the signed-in C_ADMIN's college by the server; no screen sends a college id.

### F2 shell changes

| Item | Behaviour |
|---|---|
| C_ADMIN nav | **Users** (`/college/users`, active on `/college/users/**`) · **Subjects** (`/college/subjects`, active on `/college/subjects/**`) · **Audit** · **Library** |
| `/college` home | Replaces the F1 placeholder with a hub like `/admin`: eyebrow "College admin", H1 `college.name`, code chip, then link cards **Users** ("Students and professors, one at a time or from a file"), **Subjects** ("What your college teaches, and who teaches it"), **Audit log** ("Who did what, last 30 days"). F6.3 adds the overview |
| Users sub-nav | On `/college/users` and `/college/users/import`: **People · Import** |
| Data refresh (F2.1) | Lists use React Query. A save invalidates every view it changes: a user create, edit, reset, remove or import refreshes the user lists, that user's detail and the subject list (professor names); a subject save refreshes the subject list and that subject. Signing out clears the whole query cache |

### F2.2 Users list — `/college/users`

**Purpose:** find a student or professor and manage their account. Data: `GET /college/users?role=&q=&page=&size=20&sort=` (contract §8.1). Template: List, wide.

**Tabs** (`role="tablist"`, URL `?role=professors`; default students): **Students** (`C_STUDENT`) · **Professors** (`C_PROFESSOR`). Switching tabs keeps the search and resets the page.

**Filter bar:** search (`q`, debounced 300 ms; placeholder "Search by name, email or roll no" / "… or employee ID") · Sort: Name (A–Z) / Roll no (Employee ID) / Newest (`fullName,asc` / `loginId,asc` / `createdAt,desc`).

| Column | Field | Notes |
|---|---|---|
| Name | `fullName`, `email` below in muted text | Links to the user's detail |
| Roll no / Employee ID | `loginId` | Monospace |
| Sign-in | `mustChangePassword` | Badge "Must change password" (warning) or "Active" (success) |
| Added | `createdAt` | Date only |
| (menu) | | ⋯ **Edit** · **Reset password** · **Remove** |

**Phone cards:** name + badge; email; "{Roll no} · Added {date}"; menu.

**Title row actions:** **Add student** / **Add professor** (primary, follows the tab) and **Import** (secondary link → `/college/users/import?kind={tab}`).

| State | Copy |
|---|---|
| Empty | "No students yet. Add them one at a time, or import a CSV or Excel file." (professors likewise) + **Add student** + **Import students** |
| No matches | "No students match these filters." + **Clear filters** |
| Count line | "{n} students" / "{n} professors" (`aria-live="polite"`) |

### F2.3 Add / edit user (dialog)

| Field | Label | Details |
|---|---|---|
| `fullName` | Full name | Required, ≤ 255 |
| `email` | Email | Required, valid, ≤ 255 |
| `loginId` | Roll no / Employee ID | Required, ≤ 50, monospace. Add hint: "They sign in with {college code} and this ID. Their first password is this ID, and they must change it when they first sign in." Edit hint: "Changing it doesn't change their password." |

`role` comes from the tab (add) and is never editable. Buttons **Cancel** · **Add student** ("Adding…") / **Save changes** ("Saving…").

| Error | Where | Copy |
|---|---|---|
| `LOGIN_ID_ALREADY_EXISTS` | Field `loginId` | Another student or professor at your college already uses this ID. |
| `EMAIL_ALREADY_EXISTS` | Field `email` | §0.6 copy. Add student only, one more sentence: "If it's their personal Lexly account, import them from a file to convert it." |
| `VALIDATION_ERROR` paths `fullName`, `email`, `loginId` | Field | Server reason |
| `NOT_FOUND` (edit) | Banner | §0.6 "This item no longer exists…"; the list reloads |

Success: add → toast "{fullName} added. Their first password is their roll no." (or "employee ID"); edit → toast "Changes saved."

### F2.4 Reset password (confirm)

- Title: Reset password for {fullName}?
- Body: "The password becomes their roll no ({loginId}), and they must change it at next sign-in. They'll be signed out everywhere." (employee ID for professors)
- Buttons: **Cancel** · **Reset password** ("Resetting…"). Toast "Password reset for {fullName}."

### F2.5 Remove user (typed confirm)

A hard delete (TDD §4.7), so the user types the **login ID** (`loginId`) to enable the button.

- Title: Remove {fullName}?
- Student body: "Their account is deleted for good, together with all their answers, grades and ranking entries. This can't be undone."
- Professor body: "Their account is deleted for good, and they're taken off every subject. Assessments they created stay, shown as "Former professor", and their ungraded answers can no longer be graded. This can't be undone."
- Field: "Type **{loginId}** to confirm". Buttons **Cancel** · **Remove student** / **Remove professor** ("Removing…"). Toast "{fullName} removed."

### F2.2 User detail — `/college/users/:id`

Data: `GET /college/users/{id}`. A `404` (another college's id, a C_ADMIN's id, or a removed user) shows `NotFound`.

Breadcrumb "Users / {loginId}"; H1 `fullName`; facts: role label, login ID chip, Sign-in badge, "Added {date}". Details list: Email, Roll no / Employee ID. Actions: **Edit** · **Reset password** · **Remove** (the dialogs above). After removal → the list for that role, with the toast.

Professors only: a **Subjects** card listing the subjects they're assigned to (from `GET /college/subjects`, filtered to those whose `professors` include this id), each linking to the subject. Empty: "Not assigned to any subject yet."

### F2.6 Import users — `/college/users/import`

**Purpose:** create many students or professors from a spreadsheet and see each row's outcome. Data: `POST /college/users/import/{students|professors}` (multipart `file`, contract §8.3). Reading column.

1. H1 "Import users"; Users sub-nav.
2. **Kind** segmented control: Students · Professors (URL `?kind=professors`; default students).
3. **Template**: "Start from a template: **CSV** · **Excel**" (static files `/templates/students.csv|xlsx`, `/templates/professors.csv|xlsx`, copied from the backend's `docs/templates/`). Rules under it: "Row 1 must be the header full_name, email, roll_no (any order). Up to 2,000 rows and 5 MB. Each student's first password is their roll no." (employee_id / employee ID for professors).
4. **`FileDropzone`**: a drop area that is also a button ("Choose a CSV or Excel file, or drop it here"), `accept=".csv,.xlsx"`. Keyboard: Enter/Space opens the picker. Client checks before upload: extension `.csv`/`.xlsx` ("Choose a .csv or .xlsx file."), not empty ("This file is empty."), ≤ 5 MB ("This file is larger than 5 MB. Split it into smaller files."). The chosen file shows its name and size with **Remove**.
5. **Import** (primary). While sending: a progress bar (`<progress>`, labelled) "Uploading… {n}%", then "Checking rows…" once the upload is complete; kind and file are locked.

**Results** (`ImportResultTable`)
- Summary: "{created} created · {converted} converted · {rejected} rejected · {failed} failed, out of {total}." Converted appears for students only.
- **Row** shows the spreadsheet row number (`index` as returned; the header is row 1). **Key** is headed "Roll no" / "Employee ID" (`key`, "—" when blank).
- `CREATED` and `CONVERTED` rows link to the user's detail. A `CONVERTED` row also says: "Their personal Lexly account was converted to a student account here. Their solo practice data was deleted, and their password is now their roll no."
- When rejected + failed > 0: "Fix these rows in your file and import it again. Rows already created this time will come back as rejected (ID already used); that's expected."
- All created or converted: summary in the success colour, toast "{n} users imported."

| Error | Where | Copy |
|---|---|---|
| `IMPORT_FILE_INVALID` | Under the dropzone (whole-file) | "This file can't be imported: {server message}" |
| `VALIDATION_ERROR` on `file` (> 5 MB on the server) | Under the dropzone | This file is larger than 5 MB. Split it into smaller files. |
| `NETWORK_ERROR`, 5xx | Banner | §0.6 |

### F2.7 Subjects — `/college/subjects`

Data: `GET /college/subjects?q=` (plain array, by name; contract §8.4). Template: List.

**Filter bar:** search (`q`, "Search by code or name", debounced 300 ms, in the URL).

| Column | Field | Notes |
|---|---|---|
| Subject | `name`, `code` below in muted monospace | Links to the detail |
| Professors | `professors[].fullName`, comma-separated | "None" in the warning colour when empty |
| Assessments | `assessmentCount` | |

**Phone cards:** name; code; professors line. Action: **Add subject** (primary).

| State | Copy |
|---|---|
| Empty | "No subjects yet. Add the subjects your college teaches, then assign professors to them." + **Add subject** |
| No matches | "No subjects match this search." + **Clear search** |

**Add / edit subject (dialog)**

| Field | Label | Details |
|---|---|---|
| `code` | Subject code | Required, ≤ 30, upper-cased as typed, monospace. Hint: "A short code such as CON-101." |
| `name` | Subject name | Required, ≤ 255 |
| `description` | Description | Optional, ≤ 2,000, textarea |

`SUBJECT_CODE_ALREADY_EXISTS` → field `code`: "Another subject at your college already uses this code." Add success → the subject's detail, toast "Subject added. Next, assign its professors." Edit success → toast "Subject updated."

#### Subject detail — `/college/subjects/:id`

Data: `GET /college/subjects/{id}`; `404` → `NotFound`. Breadcrumb "Subjects / {code}"; H1 `name`; code chip; "{assessmentCount} assessments"; "Updated {updatedAt}". Description as plain text (line breaks kept). Actions: **Edit** · **Delete**.

**Professors card:** each mapped professor's name (→ their user detail); **Manage professors**. Empty: "No professors yet. Only the professors assigned here can create assessments for this subject." + **Assign professors**.

**Manage professors (dialog):** a searchable multi-select.
- Search box ("Search professors"), querying `GET /college/users?role=C_PROFESSOR&q=&size=50` (debounced 300 ms).
- A checkbox list of results (name, employee ID). Selected professors also show as removable chips above the list ("Remove {name}"), so a selection survives a new search.
- "{n} selected". Buttons **Cancel** · **Save** ("Saving…") → `PUT /college/subjects/{id}/professors` with every selected id. Toast "Professors updated."
- No professors in the college: "Your college has no professors yet." + link **Add professors** → `/college/users?role=professors`.
- `VALIDATION_ERROR` on `professorIds[i]` (a professor removed meanwhile): banner "Some of these professors are no longer at your college. Check the list and save again." and the search reloads.

**Delete (confirm)**
- When `assessmentCount` > 0, or on `409 SUBJECT_IN_USE`: title "{name} can't be deleted"; body "It has assessments, and they keep their subject. If it's no longer taught under this name, rename it instead."; buttons **Close** · **Rename** (opens Edit).
- Otherwise: title "Delete {name}?"; body "Its professor assignments are removed too. This can't be undone."; **Cancel** · **Delete subject** (destructive). Success → `/college/subjects`, toast "{name} deleted."

### F2.8 Read-only subjects

No new routes; the role homes show them until F3 turns the subjects into assessment filters. **Replaced in F3:** the cards are gone and the subjects are the filter on `/professor` and `/student`.

| Role | Where | Look |
|---|---|---|
| `C_PROFESSOR` | `/professor`, section **My subjects** under the F1 placeholder | Cards: name, code, description (2 lines), "With {other professors}" when shared. Empty: "You haven't been assigned any subjects yet. Your college admin assigns them." |
| `C_STUDENT` | `/student`, section **Subjects at your college** | Same cards without professors. Empty: "Your college hasn't added any subjects yet." |

Data: `GET /college/subjects` (professors see only their mapped subjects). Loading, error and empty states as §0.3.

### F2 audit summaries

Since P2 the backend records the college actions. Summaries (F1.10 table) become:

| `action` | Summary |
|---|---|
| `USER_CREATED` / `USER_UPDATED` / `USER_REMOVED` | `details.email` (C_ADMIN accounts) or `details.loginId` (students, professors), then the role label |
| `PASSWORD_RESET` | Role label + "account", then `details.loginId` when present |
| `USER_IMPORT` | `details.kind` ("Students" / "Professors"), then "{created} created, {converted} converted, {rejected} rejected, {failed} failed of {total}" |
| `SUBJECT_*` | `details.code`, then `details.name` when present; `SUBJECT_PROFESSORS_CHANGED` adds "{n} professors" from `details.professorIds` |

---

## F3 — Assessments & answering

Contract: §0.6 (files), §0.8, §9. Professors see only their own assessments and students only their college's published and closed ones; anything else is a `404` and shows `NotFound` (contract §0.1). SUPERADMIN has no view of assessments or answers (A9 changed 2026-10-15), so F3.9 has no screen.

### F3 shell changes

| Item | Behaviour |
|---|---|
| C_PROFESSOR nav | **Assessments** (`/professor`, active on `/professor/**`) · **Library**. F6 adds Rankings |
| C_STUDENT nav | **Assessments** (`/student`, active on `/student/**`) · **Library** |
| Homes | `/professor` and `/student` become the assessment lists below. The F2.8 subject cards are replaced by the subject filter on those lists |
| Layout | Wide for `/professor/**` (lists, grid). Reading column for every `/student/**` screen and for the draft editor's form column |
| Data refresh | React Query. Any professor save, publish, delete or remove refreshes the assessment list and that assessment (detail, grid). A student upload or submit refreshes that assessment and the student list. Sign-out clears the cache |

### Shared F3 components

| Component | Behaviour |
|---|---|
| `AssessmentStatusBadge` | `DRAFT` "Draft" (neutral) · `PUBLISHED` "Published" (info) · `CLOSED` "Closed" (neutral) · `REMOVED` "Removed" (danger) |
| `StudentStateBadge` | `OPEN` "Open" (info) · `PARTIALLY_SUBMITTED` "In progress" (warning) · `SUBMITTED` "All submitted" (success) · `CLOSED` "Closed" (neutral) · `RESULTS_AVAILABLE` "Results available" (success) |
| `Deadline` | §0.4 deadline: "{instant} · in 3 days". The relative part uses the server-corrected clock (below): "in 3 days", "in 5 h 12 min" under 24 h, "in 12 min" under an hour, "in less than a minute". Under 24 h it uses the warning colour **and** says "Due soon" before it. After the due date: "{instant} · closed". No due date (drafts): "No due date yet" |
| Server clock | `offset = serverTime − device time` when the student detail arrives; countdowns use `Date.now() + offset`. Lists without `serverTime` use the device clock. The countdown re-renders every 30 s (every second in the last minute) and stops when the tab is hidden |
| `DateTimeField` | `<input type="datetime-local">` in the viewer's local time, hint "Your time zone: {IANA name} (GMT+5:30)". Sends ISO-8601 UTC; blank sends `null` |
| `MarksInput` | Number input, `step="0.5"`, `min="0.5"`, `max="100"`, `inputmode="decimal"`. Client check: > 0, ≤ 100, a multiple of 0.5 ("Use whole or half marks, such as 7.5.") |
| `PdfViewer` | A wide dialog ("{originalFilename}") with the PDF in an `<iframe>` on a blob object URL, loaded with `apiClient.download` (`no-store`). Under the frame: "If the PDF doesn't show, **download it**." (an `<a download>` on the same URL). The URL is revoked when the dialog closes. Loading: "Opening the PDF…"; failure: §0.6 copy + **Try again**; `404`: "This file is no longer available." |

### F3.1 Professor assessments — `/professor`

**Purpose:** find an assessment, see how far answering has got, start a new one. Data: `GET /professor/assessments?subjectId=&status=&page=&size=20` (default sort `dueAt,desc`, drafts without a due date first) and `GET /college/subjects` for the filter. Template: List, wide.

Title row: eyebrow "Professor", H1 "Assessments", **New assessment** (primary → `/professor/assessments/new`; disabled with the hint "You need a subject first. Your college admin assigns them." when the professor has no subjects).

**Filter bar** (URL `?subject=&status=&page=`): Subject (All subjects + "{code} · {name}" of the professor's subjects) · Status (All · Draft · Published · Closed · Removed).

| Column | Field | Notes |
|---|---|---|
| Assessment | `title`, `subject.code` + `subject.name` below (muted) | Links to the detail (drafts link to the editor) |
| Due | `dueAt` | `Deadline`; "No due date yet" for a draft without one |
| Status | `status` | `AssessmentStatusBadge` |
| Questions | `questionCount`, "{totalMarks} marks" below | |
| Submitted | `counts.submitted` of `counts.answerSlots` | "—" for drafts. Header has a hint: "Answers submitted, out of students × questions" |
| Not attempted | `counts.notAttempted` | Shown once `CLOSED` or `REMOVED`, else "—" |

The grading counts (pending evaluation, AI evaluated, published) are `0` until backend P4; F4/F5 add their columns.

**Phone cards:** title + status badge; "{code} · {name}"; deadline; "{submitted} of {slots} submitted" (not for drafts).

| State | Copy |
|---|---|
| Empty | "No assessments yet. Create one for a subject you teach; students see it once you publish it." + **New assessment** |
| Empty, no subjects | "You haven't been assigned any subjects yet. Your college admin assigns them, and then you can create assessments." |
| No matches | "No assessments match these filters." + **Clear filters** |
| Count line | "{n} assessments" (`aria-live="polite"`) |

### F3.2 Draft editor — `/professor/assessments/new` and `/professor/assessments/:id/edit`

**Purpose:** write an assessment, save it as a draft as often as needed, then publish it. Data: `GET /professor/assessments/{id}` (edit), `POST /professor/assessments` (first save), `PUT /professor/assessments/{id}` (full replace), `GET /college/subjects` (the professor's subjects). Template: Form with a side checklist from 1024 px (below it, above the save bar, on smaller screens).

Opening `/edit` for an assessment that isn't a `DRAFT` goes to its detail. `404` → `NotFound`.

Breadcrumb "Assessments / {title or "New assessment"}"; H1 "New assessment" or "Edit draft"; status badge "Draft" once saved; "Last saved {updatedAt}" (relative).

**Details group**

| Field | Label | Details |
|---|---|---|
| `subjectId` | Subject | Required. `<select>` of the professor's subjects ("{code} · {name}"). A draft whose subject is no longer mapped shows it as "{code} · {name} (no longer yours)" and the checklist fails |
| `title` | Title | Required, ≤ 255, counter |
| `instructions` | Instructions for students | Optional, ≤ 10,000, counter, textarea (6 rows). Hint "Shown above the questions. Line breaks are kept." |
| `dueAt` | Due date and time | `DateTimeField`. Hint adds: "Students can upload and submit until then. It can't be changed after publishing." Optional for a draft |

**Questions** (`RepeatableList`, item label "Question", max 50; a new assessment starts with one empty question). Each row:

| Field | Label | Details |
|---|---|---|
| `text` | Question | Textarea (4 rows), ≤ 10,000, counter |
| `maxMarks` | Max marks | `MarksInput` |
| `wordLimit` | Word limit | Number, whole, 1–10,000 ("Enter a whole number from 1 to 10,000.") |

Row ids from the server are sent back with each row (`id`), so a save keeps them; new rows send `id: null`. Under the list: **Total: {sum} marks** (`aria-live="polite"`; questions without marks are left out of the sum).

**Save bar** (sticky on phones): **Save draft** (secondary, "Saving…") · **Publish…** (primary). Draft save runs only the shape checks above (required title and subject, lengths, marks/word-limit ranges), so a half-written draft can be saved. The first save of a new assessment replaces the URL with `/professor/assessments/{id}/edit` and toasts "Draft saved."; later saves toast "Draft saved." Unsaved-changes guard on.

**Errors on save**

| Error | Where | Copy |
|---|---|---|
| Client checks / `VALIDATION_ERROR` paths (`title`, `subjectId`, `dueAt`, `instructions`, `questions`, `questions[i].text`, `questions[i].maxMarks`, `questions[i].wordLimit`) | Field or row, plus the error summary | Server reason; client copy as above, "{Label} is required." |
| `NOT_FOUND` on `subjectId` (subject not mapped) | Field `subjectId` | This subject is no longer one of yours. Choose another. |
| `ASSESSMENT_NOT_EDITABLE` | Banner, with **Open assessment** | This assessment has been published or removed, so it can't be edited any more. |
| `NOT_FOUND` (assessment gone) | Banner | §0.6 "This item no longer exists." |

### F3.3 Publish (checklist and confirm)

**Checklist** card "Before you publish", live while editing. Each line is a ✓ / ✗ icon **and** text; failing lines link to their field:

1. A subject you teach is chosen.
2. The title is filled in.
3. The due date is set and in the future.
4. There are 1–50 questions.
5. Every question has its text, max marks and word limit (failing: "Question 3 needs max marks and a word limit.", one line per question).

**Publish…** with any line failing: no request; the error summary lists the failing lines (each linking to its field) and focus moves to it. All passing: the form is saved first if it is dirty (or new), then the confirm opens:

- Title: Publish "{title}"?
- Body: "Students at your college can see it and upload answers until {dueAt, §0.4}. Once published, nothing can be edited and the due date can't be extended." + "{n} questions · {totalMarks} marks."
- Buttons: **Cancel** · **Publish** ("Publishing…"). Success → the detail, toast "Assessment published."
- `VALIDATION_ERROR` from publish (e.g. the due date passed while the dialog was open, a subject unmapped meanwhile): the dialog closes and the paths go onto the fields and the summary as on save. `ASSESSMENT_NOT_EDITABLE`: banner as on save.

### F3.4 Delete a draft / remove an assessment

| Action | Shown when | Dialog | Success |
|---|---|---|---|
| **Delete draft** | `DRAFT` (editor and detail) | Title "Delete this draft?"; body ""{title}" and its questions are deleted. This can't be undone."; **Cancel** · **Delete draft** (destructive, "Deleting…") | → `/professor`, toast "Draft deleted." |
| **Remove** | `PUBLISHED`, `CLOSED` (detail) | Title "Remove "{title}"?"; body "Students won't see it any more, and it is left out of rankings. Answers that were uploaded but not submitted are deleted; submitted answers are kept. This can't be undone."; **Cancel** · **Remove assessment** (destructive, "Removing…") | Stays on the detail (now `REMOVED`), toast "Assessment removed." |

`ASSESSMENT_NOT_EDITABLE` on either: banner "This assessment changed in the meantime. It has been reloaded." and the detail refetches.

### F3.8 Assessment detail and submissions grid — `/professor/assessments/:id`

**Purpose:** see the assessment as published and who has answered what. Data: `GET /professor/assessments/{id}`, `GET /professor/assessments/{id}/answers?questionId=&status=&q=&page=&size=50` (not for drafts). Template: Detail, wide.

Breadcrumb "Assessments / {title}". Header: H1 `title`; facts: `AssessmentStatusBadge`, subject chip "{code}" + name, `Deadline`, "{n} questions · {totalMarks} marks", "By {createdBy.fullName}" ("Former professor" when `null`). Actions: `DRAFT` **Edit draft** · **Delete draft**; `PUBLISHED`/`CLOSED` **Remove**; `REMOVED` none, and a notice "Removed {removedAt}. Students no longer see this assessment."

**Stat tiles** (not for drafts): Students (`counts.students`) · Submitted ("{submitted} of {answerSlots}") · Not attempted (`counts.notAttempted`, "—" while `PUBLISHED`).

**Questions** card: an ordered list, each "Question {position} · {maxMarks} marks · up to {wordLimit} words" then the text (line breaks kept). Drafts show the same with "Not set" for missing values, and an empty draft says "No questions yet." Instructions, when present, sit above it.

**Submissions** (not for drafts):
- Filters: Question (All questions · Question 1 … n) · Status (Any · Submitted · Uploaded, not submitted · Not uploaded · Not attempted; `NOT_ATTEMPTED` only once closed or removed) · search "Search by student name or roll no" (debounced 300 ms). Question, status and page are in the URL (`?question=&status=&page=`); the search text is **not** (it can hold a student's name or roll no, §9 rule 3) and lives in component state.
- **Grid** (from 768 px): caption "Submissions"; sticky header row and sticky first column (student name, roll no below in monospace); one column per question ("Q{position}"), or only the filtered one. Each cell is an icon + text: ✓ "Submitted" (success, with `submittedAt` in the `title`), ◐ "Uploaded" (warning; the student hasn't submitted it), ○ "Not uploaded" (muted), ✕ "Not attempted" (danger). The grid scrolls sideways inside its wrapper. In F4 a submitted cell becomes a link to the answer review.
- **Phones:** one card per student: name, roll no, then "Q1 Submitted · Q2 Uploaded · …" as a wrapped list of icon + text chips.
- Pagination by student (50 per page); count line "{n} students" (`aria-live="polite"`).
- Empty: "No students at your college yet." No matches: "No students match these filters." + **Clear filters**.

### F3.5 Student assessments — `/student`

**Purpose:** see what is due and what is done. Data: `GET /student/assessments?subjectId=&page=&size=50` (server order: open ones by due date ascending, then the rest by due date descending) and `GET /college/subjects` for the filter. Template: List, reading column, phone-first.

H1 "Assessments" (eyebrow: college name). Filter: Subject (All subjects + the college's subjects; URL `?subject=`).

The page's items are shown in three groups, keeping the server order inside each (a group with no items is left out):

| Group heading | States |
|---|---|
| To do | `OPEN`, `PARTIALLY_SUBMITTED` |
| Submitted | `SUBMITTED` |
| Closed | `CLOSED`, `RESULTS_AVAILABLE` |

**Card** (a link to the detail): subject "{code} · {name}"; title; `StudentStateBadge`; `Deadline` (warning style under 24 h); progress "{submitted} of {questionCount} submitted" plus "· {uploaded} uploaded, not submitted" when > 0; "{totalMarks} marks"; professor name ("Former professor" when `null`).

| State | Copy |
|---|---|
| Empty | "No assessments yet. When your professors publish one, it appears here." |
| No matches | "No assessments for this subject yet." + **Show all subjects** |

### F3.6 Student assessment — `/student/assessments/:id`

**Purpose:** read the questions and upload and submit one PDF answer per question. Data: `GET /student/assessments/{id}`. Template: Detail, reading column, phone-first. `404` → `NotFound`.

Breadcrumb "Assessments / {title}". Header: subject "{code} · {name}"; H1 `title`; `StudentStateBadge`; `Deadline` with the corrected clock; "{n} questions · {totalMarks} marks"; professor; progress line "{submitted} of {n} answers submitted" (`aria-live="polite"`).

Instructions (line breaks kept) under the heading "Instructions", when present. Then a notice while the assessment is open: "Upload one PDF per question: at most {maxFileMb} MB and {maxPages} pages. You can replace an upload until you submit it. Submitted answers can't be changed." (from `uploadLimits`).

**Open** means `status = PUBLISHED` and corrected now < `dueAt`. When the countdown reaches the due date, the page switches to closed at once and refetches.

**Answer card** per question, in `position` order: heading "Question {position}"; "{maxMarks} marks · up to {wordLimit} words"; the question text (line breaks kept); then the answer area:

| `answer` | Open | Closed (due date passed, or `CLOSED`) |
|---|---|---|
| `null` | Badge "Not uploaded" (neutral). `FileDropzone` (`accept="application/pdf,.pdf"`, prompt "Choose a PDF, or drop it here") | Badge "Not attempted" (danger). "Nothing was submitted for this question before the due date." |
| `UPLOADED` | Badge "Uploaded, not submitted" (warning). File line: "{originalFilename} · {size} · {pageCount} pages · uploaded {uploadedAt}". **View** · **Replace** · **Submit answer** (primary) | Badge "Not attempted" (danger). "This answer was uploaded but not submitted before the due date, so it doesn't count." No actions |
| `SUBMITTED` | Badge "Submitted" (success). File line with "submitted {submittedAt}". **View**. "Submitted answers can't be changed." | Same as open |

- **Upload** (F3.7): choosing a file (dropzone or **Replace**) checks it first: a PDF by type or `.pdf` name ("Choose a PDF file."), not empty ("This file is empty."), ≤ `maxFileMb` ("This file is larger than {maxFileMb} MB. Scan fewer pages or at a lower resolution."), starts with `%PDF-` ("This file isn't a readable PDF."). The page count is checked only by the server. Then it uploads at once with `PUT …/answer` via `apiClient.upload`: a labelled `<progress>` "Uploading {name}… {n}%" and **Cancel** (aborts; nothing changes). Other cards stay usable. Success → the card shows the new upload, toast "Answer uploaded. Submit it when you're ready."
- **Submit answer**: confirm. Title "Submit your answer to question {position}?"; body "You can't change this answer after submitting." + the file line; **Cancel** · **Submit answer** ("Submitting…"). Success → toast "Answer submitted." When this was the last one: "All answers submitted."
- **View**: `PdfViewer` on `GET /student/questions/{qid}/answer/file`.
- `resultPublished` and `progress.resultsPublished` drive the results links (F4.6).

**Errors on a card** (shown in the card, `role="alert"`, next to its controls)

| Error | Behaviour and copy |
|---|---|
| `INVALID_FILE` | Under the dropzone: the server's reason for `file` (e.g. "Must have at most 10 pages.") after "This PDF can't be used: " |
| `VALIDATION_ERROR` on `file` (over the 10 MB multipart ceiling) | "This file is larger than {maxFileMb} MB. Scan fewer pages or at a lower resolution." |
| `ASSESSMENT_CLOSED` | Refetch; the page is now closed. Card message: "The due date has passed, so this answer can't be changed." |
| `ANSWER_LOCKED` | Refetch; the card shows Submitted. Message: "This answer was already submitted." |
| `VALIDATION_ERROR` on `answer` (submit with nothing uploaded) | Refetch. Message: "Upload a PDF before submitting." |
| `NOT_FOUND` | Refetch; the assessment was removed, so the page becomes `NotFound` |
| `ABORTED` | No message |
| `NETWORK_ERROR`, 5xx, `RATE_LIMITED` | §0.6 copy in the card; the file can be chosen again |

### F3 audit summaries

| `action` | Summary |
|---|---|
| `ASSESSMENT_PUBLISHED` | `details.subjectCode` · `details.title`, then "{questionCount} questions, due {dueAt}" |
| `ASSESSMENT_REMOVED` | `details.subjectCode` · `details.title` |

---

## F4 — Manual grading & student results

Contract: §9.2 (counts), §9.3, §9.5 (grid), §10. Every `/professor/answers/{id}` endpoint is a `404` for an answer that isn't submitted or isn't on one of the caller's own assessments, which shows `NotFound`. Answers of a `REMOVED` assessment can still be read and downloaded but not graded (`409 ASSESSMENT_NOT_EDITABLE`). Approve = publish: the student sees the grade at once and it can't be changed. Students never receive AI fields or draft marks (§7.8), and the student types have no fields for them.

### F4 shell changes

| Item | Behaviour |
|---|---|
| Routes | `/professor/answers/:answerId` (C_PROFESSOR, wide) and `/student/assessments/:id/results` (C_STUDENT, reading column) |
| Data refresh | A draft save or approve refreshes that answer's review and every view of the professor's assessments (list counts, detail counts and the grid, F4.5). Sign-out clears the cache |
| URL | The review carries only ids and `?order=byStudent\|byQuestion`. Marks, feedback and student names never go into a URL (plan §9 rule 3) |

### Shared F4 components

| Component | Behaviour |
|---|---|
| `GradeStatusLabel` | For a submitted answer's grade, icon + text: ● "To grade" (`PENDING`; warning), ✓ "{finalMarks} / {maxMarks}" with the `title` "Published" (`PUBLISHED`; success). The `AI_*` statuses read "AI evaluating", "AI evaluated", "AI failed" until F5 styles them |
| `MarksInput` (grading) | Number input, `step="0.5"`, `min="0"`, `max="{maxMarks}"`, `inputmode="decimal"`. Client check: 0 ≤ marks ≤ max and a multiple of 0.5 ("Enter marks from 0 to {maxMarks}, in whole or half marks.") |

### F4.5 Grading counts on the list, detail and grid

- **Professor list** (F3.1) gains two columns after Submitted: **To grade** (`counts.pendingEvaluation`) and **Published** (`counts.published`); "—" for drafts. Phone cards add "{pendingEvaluation} to grade · {published} published" once anything is submitted.
- **Detail stat tiles** (F3.8) gain **To grade** and **Published** after Submitted.
- **Grid**: a `SUBMITTED` cell shows `GradeStatusLabel` instead of "Submitted" and is a link to `/professor/answers/{answerId}?order={order}`. Its accessible name is "Question {n}, {student}: {status text}". Other cells are unchanged and not links.
- **Grid filters**: Status gains "To grade" (`PENDING`) and "Published" (`PUBLISHED`) after "Submitted". A new **Grading order** select ("By student" · "By question", URL `?order=`, default by student) sets the order the review steps through.
- After an approve, the list, the detail tiles and the grid show the new counts the next time they are shown (React Query invalidation).

### F4.1 Answer review — `/professor/answers/:answerId`

**Purpose:** read one submitted answer and grade it. Data: `GET /professor/answers/{id}?order=` and the PDF from `GET /professor/answers/{id}/file` (the first download sets `professorDownloadedAt`, which enables AI Evaluate in F5). Template: Detail, wide; split from 1024 px (answer left, grade panel right, sticky), stacked below it with the grade panel after the PDF.

Breadcrumb "Assessments / {assessment.title} / Question {position}". The title links to the assessment detail.

Header: eyebrow "Question {position} of {assessment.title}"; H1 `student.fullName` ("Unnamed student" when blank); facts: roll no (monospace), "Submitted {submittedAt}", `AssessmentStatusBadge` when not `PUBLISHED`/`CLOSED` (i.e. `REMOVED`).

**Answer column**
- Question card: "{maxMarks} marks · up to {wordLimit} words", the question text (line breaks kept).
- File line: "{originalFilename} · {size} · {pageCount} pages".
- The PDF inline in a frame (same loading as `PdfViewer`: "Opening the PDF…", failure + **Try again**, `404` "This file is no longer available."), with "If the PDF doesn't show, **download it**." and an **Open full screen** button that opens `PdfViewer`.

`REMOVED` assessment: notice above the columns, "This assessment was removed, so its answers can't be graded any more. You can still read them."

### F4.2 Grade panel

Heading "Grade"; status line: "Not published. The student can't see your marks or feedback yet." (unpublished) or the Published state below.

**Editable** (grade not `PUBLISHED`, assessment not `REMOVED`):

| Field | Label | Details |
|---|---|---|
| `finalMarks` | Marks (out of {maxMarks}) | `MarksInput` (grading). Prefilled from `grade.finalMarks` |
| `finalFeedback` | Feedback for the student | Textarea (8 rows), ≤ 10,000, counter. Hint "The student sees this with their marks once you publish." Prefilled from `grade.finalFeedback` |

Buttons: **Save draft** (secondary, "Saving…") · **Approve & publish…** (primary).

- **Save draft**: `PUT …/grade` with both fields (blank marks → `null`, blank feedback → `null`). Client checks: the marks rule (when filled) and the feedback length. Success: toast "Draft saved. The student can't see it yet."; the history gets a "Draft saved" row.
- **Approve & publish…**: client checks first: marks required ("Enter the marks."), feedback required ("Write feedback for the student."), plus the save checks. Failing checks put errors on the fields and focus the first one; no request. Then the confirm:
  - Title: Publish the grade for question {position}?
  - Body: "{student} sees {marks} / {maxMarks} and your feedback immediately. A published grade can't be changed."
  - Buttons: **Cancel** · **Publish grade** ("Publishing…").
  - `POST …/approve` with both fields (saved and approved in one step). Success: toast "Grade published."; the panel turns read-only; focus moves to **Next ungraded** when there is one.
- Unsaved-changes guard on while the fields differ from the saved grade (covers Previous / Next and leaving the page).

**Published** (read-only): badge "Published"; "Published {publishedAt} by {gradedBy.fullName}" ("by a former professor" when `null`); "**{finalMarks} / {maxMarks}**"; the feedback (line breaks kept). No buttons.

**Removed assessment**: the panel shows the saved values read-only and the notice above; no buttons.

**Errors**

| Error | Where | Copy |
|---|---|---|
| `INVALID_MARKS` | Field `finalMarks` | Enter marks from 0 to {maxMarks}, in whole or half marks. |
| `VALIDATION_ERROR` `finalMarks` / `finalFeedback` | Fields | "Enter the marks." / "Write feedback for the student." / "Feedback must be at most 10,000 characters." |
| `GRADE_PUBLISHED` | Banner, then refetch (the panel shows the published grade) | This grade has already been published, so it can't be changed. |
| `ASSESSMENT_NOT_EDITABLE` | Banner, then refetch | This assessment was removed, so its answers can't be graded any more. |
| `NOT_FOUND` | Refetch → `NotFound` | — |
| Other | Banner | §0.6 |

### F4.3 Grading flow

A nav bar above the columns, "Answer navigation": **← Previous** (`navigation.previousAnswerId`) · **Next →** (`nextAnswerId`) · **Next ungraded →** (`nextUngradedAnswerId`; primary once this grade is published). Each keeps `?order=`. A missing target is a disabled button, and when there is no ungraded answer after this one the bar says "No ungraded answers after this one." with a link **Back to submissions**. A **Grading order** select ("By student" · "By question") replaces `?order=` in place. The list doesn't wrap around (contract §10.1).

### F4.4 Grade history

A collapsed `<details>` under the panel: "Grade history ({n})". An ordered list, oldest first. Each entry: event ("Draft saved", "AI evaluated", "AI evaluation failed", "Published") · "{marks} / {maxMarks}" (or "No marks") · actor ("{fullName}", "Lexly AI" for AI events with no actor, "Former user" otherwise) · time; then the feedback saved by that event (line breaks kept, muted), or "No feedback". Empty: "No changes yet."

### F4.6 Student results — `/student/assessments/:id/results`

**Purpose:** see published marks and feedback. Data: `GET /student/assessments/{id}/results`. Template: Detail, reading column, phone-first. `404` → `NotFound`.

**Entry points**
- Student assessment (F3.6): when `progress.resultsPublished` > 0 (or any `resultPublished`), a **View results** button in the header, and on each answer card whose `resultPublished` is true the line "Your result is published. **View results**".
- Student list (F3.5): a card in `RESULTS_AVAILABLE` links to the results; any card with published results adds "{n} results published".

Breadcrumb "Assessments / {title} / Results" ({title} links to the assessment). Header: eyebrow "{code} · {name}"; H1 "Results: {title}"; `AssessmentStatusBadge`-free facts: `Deadline`.

**Total** card: "{publishedMarks} / {publishedMaxMarks}" with the label "Marks, of published questions" and "{published} of {n} questions published · the assessment is out of {totalMaxMarks} marks." With nothing published: "No marks are published yet. Your professor publishes each answer's marks when it is graded."

**Question cards** in `position` order: heading "Question {position}"; outcome badge; the question text (line breaks kept, muted); the marks line; feedback.

| `outcome` | Badge | Marks line | Body |
|---|---|---|---|
| `PUBLISHED` | "Published" (success) | "{finalMarks} / {maxMarks}" | "Feedback from your professor" + `finalFeedback` (line breaks kept); "Published {publishedAt}" |
| `AWAITING_EVALUATION` | "Awaiting evaluation" (info) | "— / {maxMarks}" | "Your answer was submitted and hasn't been graded yet." |
| `NOT_ATTEMPTED` | "Not attempted" (danger) | "0 / {maxMarks}" | "Nothing was submitted before the due date." |
| `NOT_SUBMITTED` | "Not submitted" (neutral) | "— / {maxMarks}" | "The assessment is still open. **Go to your answers**" |

Below: **Back to your answers** (→ `/student/assessments/{id}`).

### F4 audit summaries

| `action` | Summary |
|---|---|
| `GRADE_EDITED` | "Question {questionPosition} · {finalMarks} marks" ("no marks" when `null`) |
| `GRADE_PUBLISHED` | "Question {questionPosition} · {finalMarks} marks" |

---

## F5a — AI legal tutor

Contract: §11a (TDD §10a). Every role may use the tutor. The browser calls only `lexly-backend`; it never talks to `lexly-ai-service`. Answers arrive whole (no streaming) and can take up to about 60 s, so the ask call has no client-side timeout. Each user has 10 questions a day, reset at midnight India time; a "not found" answer counts, a failed call (`AI_UNAVAILABLE`) doesn't. Conversations are private (not even SUPERADMIN can read another user's) and are deleted 24 h after their last message. Question and answer text never goes into a URL, a log or the audit log.

### F5a shell changes

| Item | Behaviour |
|---|---|
| Routes | `/tutor` (a new chat) and `/tutor/:conversationId` for every role, wide, a lazy chunk. `/admin/tutor` (SUPERADMIN, wide) |
| Nav | A **Tutor** item (chat-bubble icon) for every role: SUPERADMIN Colleges · Content · Audit · **Tutor** · Library (its `matches` include `/admin/tutor`); C_ADMIN Users · Subjects · Audit · **Tutor** · Library; C_PROFESSOR and C_STUDENT Assessments · **Tutor** · Library; S_STUDENT Home · Bare Acts · Practice · **Tutor** · Profile |
| `/admin` hub | A **Tutor** card: "Re-index the tutor and see AI spend" |
| Data refresh | Tutor responses are `no-store`. Sending a question updates the open conversation and the quota from the `POST` response and refetches the conversation list. Sign-out clears the cache |
| URL | Only the conversation id, the admin `?tab=` and the spend filters. Never question or answer text |

### F5a.3 Tutor — `/tutor` and `/tutor/:conversationId`

**Purpose:** ask legal questions and get answers cited from Lexly's library and study material. Data: `GET /tutor/quota`, `GET /tutor/conversations`, `GET /tutor/conversations/{id}`, `POST /tutor/messages`, `DELETE /tutor/conversations/{id}`.

**Layout.** Header: eyebrow "Lexly tutor"; H1 "Ask the tutor"; for SUPERADMIN only, a link **Tutor admin** (→ `/admin/tutor`). From 1024 px, two panes: **Your chats** on the left (18 rem), the thread on the right. Below 1024 px one pane at a time: the thread, with a **← All chats** button above it, or the list (opened by that button; picking a chat or **New chat** returns to the thread). The composer sits under the thread, the quota line under the composer and the disclaimer under that.

**Your chats** (`aside`, heading "Your chats")
- **New chat** (primary, → `/tutor`). Disabled while a question is being answered.
- One row per conversation, in the server's order (newest `lastMessageAt` first): the `title` on one line (ellipsis, full title as `title`), and below it, muted, "deletes in {n} h" ("deletes in {n} min" under an hour, "deleting soon" once past `expiresAt`), with the exact `expiresAt` as `title`. The open conversation has `aria-current="page"`. A **Delete** icon button per row (accessible name "Delete chat: {title}").
- Loading: skeleton. Error: `ErrorState` with **Try again** (the thread still works). Empty: "No chats in the last 24 hours."
- **Delete** → `ConfirmDialog`: title "Delete this chat?"; body "This chat will be deleted now. Chats are deleted automatically 24 h after the last message anyway."; **Cancel** · **Delete chat** (danger, "Deleting…"). Success (or a `404`, it's already gone): toast "Chat deleted."; the list refreshes; deleting the open chat goes to `/tutor`.

**Thread**
- New chat (`/tutor`), no messages yet: a short explainer, "Ask about any act, section or case law in Lexly. Answers cite their sources, so you can read the law itself." and the heading "Try asking" with three example buttons that fill the composer (and focus it): "Is a contract with a minor void?", "What is the difference between culpable homicide and murder?", "When can a court grant anticipatory bail?".
- `/tutor/:id`: loading skeleton; `GET` `404` → in the thread pane, "This conversation has expired or was deleted." (heading level 2) with **New chat**; other errors → `ErrorState` with **Try again**.
- Messages oldest first as an ordered list (`aria-label` "Conversation"). `USER`: right-aligned bubble, label "You" (visually hidden), the text with line breaks kept. `ASSISTANT`: full width, label "Tutor" (visually hidden), the answer, then its sources.
- **Pending message.** On send the question appears at once as a `USER` message, followed by a status row "Answering… this can take up to a minute" (a spinner + text) in a polite live region. One question in flight: **Send** and **New chat** are disabled until it settles. Navigating to another chat while it runs is allowed; the answer is still saved into its conversation, and a new chat's answer only moves the URL if the user is still on `/tutor`.
- **On success:** the pending message is replaced by the server's `question` and `answer`; a new chat replaces the URL with `/tutor/{conversation.id}` (replace, not push); the quota line takes `quota` from the response; the chat list refreshes; focus stays in the composer and the live region announces "Answer received."
- **Failure** (`AI_UNAVAILABLE`, `NETWORK_ERROR`, `INTERNAL_ERROR` and anything not listed below): the pending question stays, marked with an alert and two buttons: **Try again** (resends the same question to the same conversation) and **Edit question** (puts the text back in the composer and removes the pending message). For `AI_UNAVAILABLE` the alert reads "The tutor couldn't answer just now. Your question wasn't counted." (nothing was stored). For anything else the server may have answered and counted it, so the alert reads "The answer didn't reach you. The tutor may still have answered, so check Your chats before trying again." and the chat list, the open chat and the quota are refetched.
- **Daily reset:** with `remaining` 0, the quota is refetched just after `resetsAt`, so an open tab unblocks at midnight India time.

**Answer rendering** (plain text only, built from text nodes; never `dangerouslySetInnerHTML`)
- Paragraphs split on blank lines; single line breaks are kept.
- `[n]` markers: a marker is `[` + digits + `]`, wherever it appears (also straight after a word, as in "void[1]."). When `n` matches a `citations[].ref`, it becomes a small superscript button with the text `n` and the accessible name "Source {n}: {label}"; activating it scrolls to that source, opens its snippet, focuses it and highlights it for 2 s. A marker with no matching citation stays as plain text. Adjacent markers (`[1][2]`) become two buttons.
- **Sources** under the answer (heading "Sources", visually styled small): an ordered list by `ref`, each item numbered "[{ref}]":
  - `SECTION` / `CASE_LAW`: `label` as a link to `/sections/{sourceId}` or `/caselaws/{sourceId}`. A source deleted since the last Re-index opens that page's normal Not Found.
  - `FILE`: "{label} · {location}" (just `label` when `location` is `null`), plain text, with a muted "Study material" tag. No link.
  - The `snippet` in a `<details>` ("Cited passage"), shown as a quote; open by default from 768 px, collapsed below.
- **Not-found answers** (`notFound: true`): the fixed sentence in a muted note (an info icon + text), then "Try naming the act or section." and "This still used one of today's questions." No sources.

**Composer**
- A labelled textarea ("Your question", 3 rows, grows to 8), counter "{n} / 2,000" (warning style past 2,000). **Enter** sends, **Shift+Enter** adds a line (IME composition is never sent). **Send** (primary, "Sending…" while in flight).
- Client checks on send: blank → "Type a question first."; over 2,000 → "Questions can be at most 2,000 characters." (mirrors the `@Size`). Field error under the textarea; no request.
- While answering, the textarea stays editable (the next question can be typed) but **Send** is disabled.

**Quota line** (under the composer, `aria-live="polite"`): "{remaining} of {limit} questions left today · resets at {time}". `{time}` is `resetsAt` in the viewer's local time ("12:00 am" for a viewer in India); when that falls on a later local date and isn't midnight, "{time} tomorrow" (e.g. "4:30 am tomorrow" at UTC+10). It is loaded once from `GET /tutor/quota` and then updated from each `POST` response, not refetched. Loading: "Checking today's questions…". Error: nothing shown (sending still works). With `remaining` 0 the composer is disabled and the quota banner shows.

**Quota banner** (`QUOTA_EXCEEDED`, or `remaining` 0 on load; `role="status"`, warning tone, above the composer): "You've used today's 10 questions. They reset at midnight India time ({time})." `{time}` as in the quota line, refetched from `GET /tutor/quota` after a `QUOTA_EXCEEDED`. The typed question is kept in the composer (a pending one goes back into it).

**Disclaimer** (muted, small): "Answers come only from Lexly's library and study material and may be incomplete. Check the cited sources."

**Errors** (§0.6 for the rest)

| Error | Where | Copy |
|---|---|---|
| `QUOTA_EXCEEDED` | Quota banner; composer disabled; the question back in the composer | See above |
| `AI_UNAVAILABLE` | On the pending message, with **Try again** / **Edit question** | The tutor couldn't answer just now. Your question wasn't counted. |
| `NETWORK_ERROR`, 5xx | On the pending message, with **Try again** / **Edit question**; chats and quota refetched | The answer didn't reach you. The tutor may still have answered, so check Your chats before trying again. |
| `NOT_FOUND` on send with a `conversationId` | Go to `/tutor`; notice above the composer; the question back in the composer; the chat list refreshes | This conversation has expired or was deleted. Your question is still below; send it to start a new chat. |
| `VALIDATION_ERROR` `question` | Field error; the question back in the composer | "Type a question first." / "Questions can be at most 2,000 characters." |

### F5a.4 Tutor admin — `/admin/tutor` (SUPERADMIN)

**Purpose:** keep the tutor's index current and watch AI spend. Template: List, wide. Breadcrumb "Administration / Tutor". Eyebrow "Super admin"; H1 "Tutor admin". Two tabs in the URL (`?tab=index|spend`, default `index`, changed with replace): **Index** · **Spend**.

**Index tab** — data: `GET /superadmin/tutor/index-runs`, `POST /superadmin/tutor/index-runs`.
- **Re-index** (primary), disabled with the hint "A run is in progress." while the latest run is `RUNNING`. It opens a `ConfirmDialog`: title "Re-index the tutor?"; body "Lexly re-reads the PDF folder and the whole library in the background. This can take several minutes. Unchanged passages are reused, so a re-run is cheaper than the first."; **Cancel** · **Re-index** ("Starting…"). `202`: the new run becomes the latest run; toast "Re-index started." `409 INDEX_RUN_IN_PROGRESS`: no error; the runs are refetched and a polite note says "A re-index is already running."
- **Latest run** card (heading "Latest run"): status badge ("Running" info, "Succeeded" success, "Failed" danger) and a facts list:
  - Started: "{startedAt} by {startedBy.fullName}" ("by a removed user" when `null`)
  - Duration: from `startedAt` to `finishedAt` ("4 min 12 s"); while running "Running for {duration}"
  - Files: "{ingested} ingested · {failed.length} failed", then the failed file names as a list
  - Library: "{sections} sections · {caseLaws} case laws"
  - Chunks: "{embedded} embedded · {reused} reused · {removed} removed"
  - Embedding tokens: "{embeddingTokens}"
  - `FAILED`: an alert with `error` ("The run failed." when blank)
  - While `RUNNING`, the counts not known yet are 0; a polite status "Re-indexing… this page updates every 5 seconds."
- **Polling:** `GET …/index-runs` every 5 s only while the first run is `RUNNING`; it stops when that run finishes or the page unmounts. When a watched run finishes, the live region says "Re-index finished: {status label}."
- **Previous runs** (heading "Previous runs"): the other runs (at most 9). Table from 768 px, cards below; columns Started · Status · Started by ("Removed user" when `null`) · Duration · Files (ingested / failed) · Chunks embedded · Embedding tokens. Empty: "No earlier runs."
- No runs at all: `EmptyState` "The tutor hasn't been indexed yet. Re-index once so it can answer from the library." with **Re-index…**.

**Spend tab** — data: `GET /superadmin/ai-usage/daily?from=&to=&collegeId=&role=` and the colleges list (for the filter).
- **Filters** (URL `from`, `to`, `collegeId`, `role`): From and To (date inputs; default the last 30 days up to today, as India dates), College ("All colleges" + every college), Role ("All roles", "Super admin", "College admin", "Professor", "College student", "Solo student"). Client checks: both dates present ("Enter both dates."), `to ≥ from` ("The start date must be on or before the end date."), at most 366 days inclusive ("Choose a range of at most 366 days."). An invalid range shows the error under the dates and sends no request. **Clear filters** when any filter is set.
- **Stat tiles** from `totals`: Cost ("$0.6447": USD with 2–4 decimals), Questions, Index runs, Input tokens, Output tokens, Embedding tokens.
- **Daily cost chart** (heading "Daily cost"): a bar per day in `days` (oldest first), drawn in plain SVG (no chart library). The y-axis starts at 0 with 3–4 gridlines labelled in USD; the x-axis labels a few dates ("19 Oct"). Bars in `--lx-accent`. Hovering a bar, or focusing the chart and moving with ←/→ (Home/End for the ends), shows a tooltip "{date} · ${cost} · {questions} questions" and highlights the bar. The SVG has `role="img"` and the label "Daily AI cost from {from} to {to}, total ${cost}". All-zero range: the bars are flat, and the note "No AI use in this range." **Show as table** / **Hide table** toggles a table with Date · Questions · Index runs · Input tokens · Output tokens · Embedding tokens · Cost.
- **Footnotes** (muted): "Rates now: ${input} / ${output} / ${embedding} per million input / output / embedding tokens. Past days keep the rate of their time." With a college or role filter: "Index runs aren't tied to a college or role, so they're excluded."
- Loading: skeleton tiles; a refetch keeps the previous data with `aria-busy`. Error: `ErrorState` with **Try again**. `400 VALIDATION_ERROR` (the dates are checked first, so it means another filter): "These filters can't be used. Clear them and try again." with **Clear filters**. `404` for an unknown `collegeId`: "This college no longer exists." with **Clear filters**.

### F5a audit summaries

None. Tutor questions and answers are never audited (contract §11a). Index runs are visible on the Index tab.

---

## UR — UI refresh

Plan section UR. Approved design: the "Lexly UI refresh" canvas (2026-10-20). Frontend only; no endpoint changes. Where this section and an earlier screen section disagree on **look or shell**, this section wins; behaviour, data and copy stay as specified per screen.

### UR.1 Visual language

**Tokens** (`src/index.css`; existing names keep working, with new values):

| Token | Value | Use |
|---|---|---|
| `--lx-page` (new) | `#E6EFFB` | Page background around the frame |
| `--lx-sidebar` (new) / `--lx-navy` | `#1C1C1E` | Sidebar, frame, primary buttons, icon chips, headings' ink accents |
| `--lx-sidebar-text` (new) | `#C9CBD3` | Inactive sidebar items |
| `--lx-card` | `#FFFFFF` | Content panel, cards |
| `--lx-ivory` | `#F2F4F8` | Subtle surfaces (hovers, inputs, round icon buttons) |
| `--lx-ivory-deep` / `--lx-border` | `#E3E6EC` | Borders, dividers |
| `--lx-ink` / `--lx-muted` | `#141416` / `#5F6370` | Text / secondary text (≥ 5.5:1 on white and `--lx-ivory`) |
| `--lx-sky` + `--lx-sky-ink` (new) | `#DCE9FB` + `#1F4E8C` | Hero cards, info badges |
| `--lx-lavender` + `--lx-lavender-ink` (new) | `#E6E0F5` + `#45366F` | Placard 1 |
| `--lx-mint` + `--lx-mint-ink` (new) | `#DDF0E1` + `#23683A` | Placard 2, success badges |
| `--lx-cream` + `--lx-cream-ink` (new) | `#F7EFD3` + `#7A560A` | Placard 3, warning badges |
| `--lx-cta` (new) | `#BFD8F7` | Button on the dark action card |
| `--lx-gold` / `--lx-gold-soft` / `--lx-gold-ink` | `#3E7FD3` / `#DCE9FB` / `#1F4E8C` | Former gold accent, now blue: chart lines, highlights, small accent text |
| `--lx-wrong` | `#B42318` | Errors, destructive actions |
| `--lx-radius` / `--lx-radius-sm` (new) | `20px` / `12px` | Cards and placards / inputs, buttons, chips |

Pastels mark **categories** (which placard, which source). Statuses always keep their text label; colour never carries meaning alone. Every pastel pairs only with its own `-ink` colour or `--lx-ink` for text.

**Type.** `--lx-sans`: Manrope (self-hosted variable font) for all interface text, headings included: H1 34 px / 800 / −0.02em (28 px on phones), section headings 20 px / 800, card labels 13–15 px / 600–700, numbers tabular. `--lx-serif`: Source Serif 4 for legal reading text only: section and case-law bodies, illustrations, "in simple words", tutor answers and cited passages.

**Components.**
- Buttons: primary black with white text, 12 px radius; secondary white with a `--lx-border` border; the dark card's button `--lx-cta` with ink text. 44 px minimum height.
- Placard (`LinkTile`): a pastel card (radius 20, min-height 150 px) that is one link: the number (24 px / 800), the label in its `-ink`, a black 40 px icon chip and "{action} →". It opens a screen.
- Hero card: `--lx-sky`, radius 20, a heading line, a big number and a small chart or progress bars.
- Action card: `--lx-sidebar` background, white heading with one word in an outlined pill, short muted text, a `--lx-cta` button.
- Tables: no outer border; header 12 px `--lx-muted`; rows separated by 1 px `#F0F1F4`; first column can lead with a black 36 px chip (initials or code).
- Filter pills: rounded 999 px selects/buttons with a border.
- Badges: pill, 12 px / 700, pastel background with its `-ink` text.

### UR.2 Shell

**From 768 px.** The page is `--lx-page` with a 16 px gutter (28 px from 1280 px). Inside it, a black frame (radius 34 px) holds:
- **Sidebar** (`<nav aria-label="Primary">`, sticky, full frame height): the logo tile (cream `§` → role home), the role's items, then at the bottom the collapse toggle and Log out. **Collapsed** (default) is a 76 px icon rail: each item's label is visually hidden (still its accessible name) and shown as a `title` tooltip. **Expanded** is 220 px with icon + label, and the logo shows "Lexly" (plus the college code for college roles). The toggle is a button "Collapse sidebar" / "Expand sidebar" with `aria-expanded`; the choice is kept in `localStorage` (`lexly.sidebar`), a UI preference only. The current item is a white pill with ink text (`aria-current="page"`); others are `--lx-sidebar-text`.
- **Panel**: white, radius 26 px, padding 30/36 px. Its **top bar** holds the context line on the left (college name for college roles, "Super admin", or nothing) and on the right: a round Library search button (→ `/search`), notifications, and the profile pill (initials + name → `/profile`). The page's own H1 follows.

Sidebar items: the role's home item first, then the role's nav (F0.3 list, plus the Tutor), so the sidebar may hold more than 5. Home items: SUPERADMIN "Overview" (`/admin`), C_ADMIN "Overview" (`/college`), C_PROFESSOR "Teaching desk" (`/professor`), C_STUDENT "My studies" (`/student`), S_STUDENT "Study hub" (`/dashboard`).

**Below 768 px.** White page, no frame. A top bar (logo chip, notifications, profile) and a **floating black bottom tab bar** (12 px from the edges, radius 24 px): at most 5 items, the current one a white pill. The H1 is 28 px. Content keeps the 16 px gutter and clears the tab bar.

While the password must be changed, the sidebar and tab bar show only Log out (F1.2 unchanged).

### UR.3 Role homes

Each home: top row of a hero card (≈ 40 %) and a "placards" group of three tiles; below, a table (≈ 60 %) and the dark action card. Loading: skeletons per card; one failing card shows its own error and never blanks the page (§0.3). Numbers come only from the listed endpoints.

| Role · route · H1 | Hero | Placards (number · label → target) | Table | Action card |
|---|---|---|---|---|
| SUPERADMIN · `/admin` · **Overview** | AI spend, last 30 days: total cost, questions, index runs, daily cost line (`GET /superadmin/ai-usage/daily`) → "Open spend" (`/admin/tutor?tab=spend`) | Active colleges (`/superadmin/colleges?active=true` total) → Colleges · Students and professors across colleges (sum of the colleges list `counts`) · Last index run status and duration (`/superadmin/tutor/index-runs`) → `/admin/tutor` | Colleges (name + code chip, students, professors, admins, status), up to 5 by name, → "All colleges" | "Keep the **tutor** up to date" → Re-index (`/admin/tutor`) |
| C_ADMIN · `/college` · **Overview** (context line: college name) | People at your college: students + professors, with a split bar of the two (`/college/users?role=` totals; the C_ADMIN endpoints give no admin count, so admins aren't shown) → All users | Students → `/college/users` · Professors → `/college/users?role=professors` · Subjects (`/college/subjects` length) → `/college/subjects` | Recent activity (`GET /audit`, last 7 days, 5 rows: action, by, details summary, when) → Audit log | "Add a whole **batch** at once" → Import users |
| C_PROFESSOR · `/professor` · **Teaching desk** | Grading progress: published of submitted, a bar per open/closed assessment (published vs to grade) from `/professor/assessments` `counts` | Answers to grade (sum of `pendingEvaluation`) → the first assessment with answers to grade · Open assessments (`PUBLISHED`) → `/professor/assessments?status=PUBLISHED` · Next due (soonest future `dueAt`) → that assessment | Your assessments (code chip, title + subject, due, submitted, to grade, status), 5 newest → `/professor/assessments` | "Set the next **problem**" → New assessment |
| C_STUDENT · `/student` · **My studies** | Due next: the soonest open assessment, subject and professor, "Due in …", answer progress bar → Continue answering | Open assessments (`OPEN` + `PARTIALLY_SUBMITTED`) → `/student/assessments` · Results published (assessments with `resultsPublished` > 0) → the list filtered · Tutor questions left today (`/tutor/quota`) → `/tutor` | Assessments (code chip, title + subject, due, answers submitted of questions, state badge), 5 by due date → `/student/assessments` | "Stuck on a **section**? Ask the tutor" → `/tutor` |
| S_STUDENT · `/dashboard` · **Study hub** | "Find any section or case law": the universal search and 3 act shortcuts | Bare acts (`/acts` length) → `/acts` · Case laws (`/caselaws` total) → `/caselaws` · Tutor questions left today → `/tutor` | Bare acts (code chip, name, year), 5 → `/acts` | "Learn with the **tutor**" → `/tutor` (mentions solo practice is coming soon) |

Empty states: no colleges / users / assessments → the table shows the existing empty copy with its primary action; a placard with 0 still shows 0.

### UR.4 Screens

Every other screen keeps its layout, data and copy, restyled with UR.1 inside the panel: title rows use the new H1; filter bars use filter pills; lists use the new tables (cards on phones as today); stat tiles become white cards with a border; tabs keep their markup with a black underline; dialogs get radius 20 and the new buttons. Library reading pages: the H1 and chrome in sans, the statute and case-law text in the serif, the study panel keeps one colour per kind of content, mapped to the new pastels by family (amber → cream, purple → lavender, blue → sky, green → mint; each dark tone keeps ≥ 4.5:1 for white text). The tutor's sources become pastel cards per source type (section lavender, case law mint, file cream).

---

## F5b — Vocab & Maxims

Contract: §11b (LIVE, P5b; TDD §7.11). Two read-only glossaries for **every role**: **Vocab** (key legal terms taken from sections) and **Maxims** (legal principles taken from case laws). There are no writes and nothing is audited. From P8a an S_STUDENT whose trial has ended gets `402 PLAN_REQUIRED` here (F8a); until F8a lands that falls through to the generic error.

### F5b shell changes

| Item | Behaviour |
|---|---|
| Routes | `/vocab` and `/maxims` for every role (shared like the Library, not in `AREAS`), wide, one lazy chunk |
| Library sub-nav | Bare Acts · Case Laws · **Vocab** · **Maxims** · Search, for every role that has it (all but S_STUDENT, F0.3) |
| S_STUDENT | No sub-nav and the tab bar is unchanged. The Study hub's "Your library" group gets a fourth placard (below), and both pages show a **Vocab ⇄ Maxims** switch under the H1, a two-link `nav` (`aria-label` "Glossary") with `aria-current="page"` on the open one. No tab is active on these pages |
| Study hub (UR.3) | Fourth placard, tone sky: value = `totalElements` of `GET /vocab?size=1` ("1,240"), label "Legal terms and maxims", action "Glossary" → `/vocab`. With four placards the group is 2 × 2. On an error (including a `402` from P8a) the placard shows no number and still links to `/vocab` |
| URL | `q`, `letter` and `page` (1-based). An invalid `letter` (not one letter A–Z or `#`) is dropped with a replace. `#` is written `%23` |

### F5b.3 Vocab — `/vocab` · Maxims — `/maxims`

One screen with two configurations. Data: `GET /vocab?q=&letter=&page=&size=20` or `GET /maxims?…`.

| | Vocab | Maxims |
|---|---|---|
| Eyebrow · H1 | "Legal terms" · **Vocab** | "Legal principles" · **Maxims** |
| Intro (muted) | "Key terms defined in the bare acts, A to Z." | "Principles the courts have laid down, A to Z." |
| Entry | `term` (bold) → `definition` | `title` (bold) → `explanation` |
| Source link | "{actShortCode} · s. {sectionNumber}" → `/sections/{sectionId}` | `caseTitle` → `/caselaws/{caseLawId}` |
| Search label · placeholder | "Search terms" · "Search terms and definitions" | "Search maxims" · "Search maxims and explanations" |
| Noun (count, empty) | term / terms | maxim / maxims |

**Layout.** Title row (eyebrow, H1, intro), then the S_STUDENT switch, then a filter bar: the search box (`type="search"`, `maxLength` 100, debounced 300 ms like Case Laws; Enter commits at once; a clear button) and below it the **letter bar**. Then the count line, the entries and `Pagination`.

**Letter bar** (`nav`-less group, `role="group"`, `aria-label` "Filter by first letter"): **All** · A … Z · **#**. Each is a toggle button with `aria-pressed`; **All** is pressed when no letter is set. `#` has the accessible name "Other: not starting with A to Z". Tab reaches the group; ←/→ move between buttons (roving tabindex), Home/End jump to the ends, Enter/Space choose. From 768 px it wraps onto as many lines as needed; below 768 px it is one line that scrolls sideways inside its row (the page never scrolls sideways), with the pressed letter scrolled into view. Choosing a letter or changing the search resets the page to 1 and keeps the other filter: letter and search combine.

**Count line** (`aria-live="polite"`): "{n} terms" · "{n} terms under K" · "{n} terms under #" · "{n} terms matching '{q}'" · "{n} terms under K matching '{q}'" (singular when 1; "maxims" on Maxims).

**Entries** as one `<dl>` in the server's order (A–Z): `<dt>` the term or title, `<dd>` the definition or explanation as plain text with line breaks kept, then the source link on its own line, muted, with a book (section) or scales (case law) icon. The server already removes duplicates, so the term is the React key. Each entry is a card on phones; from 768 px a two-column grid of cards.

**States**
- Loading: skeleton of 6 cards. A refetch (paging, filter change) keeps the previous results with `aria-busy` on the list.
- Empty, no filter: "No terms yet." (Maxims: "No maxims yet.")
- Empty with a letter: "No terms under K." + **Show all letters**.
- Empty with a search: "No terms match '{q}'." + **Clear search** (and **Show all letters** when a letter is set too).
- `400 VALIDATION_ERROR` (only from a hand-edited URL, since the client limits `q` and drops bad letters): "These filters can't be used." + **Clear filters**.
- Other errors: `ErrorState` with **Try again** (§0.6). `402 PLAN_REQUIRED`: the generic error until F8a, then `PlanGate`.

**Phone (390 px):** single column; the search box full width; the letter bar scrolls sideways; `Pagination` shows Previous / Next with "Page 2 of 14".

---

## F5c — Subject notes

Contract: §11c (LIVE, P5c; TDD §7.12). Professors share study notes (PDF, Word or PowerPoint, up to 20 MB) for the subjects they teach. Every C_STUDENT of the college can open them, and the C_ADMIN lists and deletes them. S_STUDENT and SUPERADMIN never see notes. Every response is `no-store`; files are never cached (plan §9.4).

### F5c shell changes

| Item | Behaviour |
|---|---|
| Nav (D11) | The sidebar and the phone tab bar become separate lists (`sidebarFor`, `tabsFor`). Sidebar: C_ADMIN Overview · Users · Subjects · **Notes** · Audit · Tutor · Library; C_PROFESSOR Teaching desk · Assessments · **Notes** · Tutor · Library; C_STUDENT My studies · Assessments · **Notes** · Tutor · Library. Tab bars (≤ 5): C_ADMIN Users · Subjects · **Notes** · Tutor · Library (Audit moves off the tab bar; reached from the Overview's Recent activity → Audit log; in F6a Analytics takes Notes' tab and Notes is reached from the Overview and the subject screens); C_PROFESSOR Desk · Assessments · **Notes** · Tutor · Library; C_STUDENT Studies · Assessments · **Notes** · Tutor · Library. Icon: a document with lines. SUPERADMIN and S_STUDENT unchanged |
| Routes | `/professor/notes`, `/student/notes`, `/college/notes`, in their role areas (wide for professor and college as today; `/student/notes` uses the standard width, mobile first) |
| C_ADMIN Overview | A "Study notes →" link under the placard group, → `/college/notes` |
| URL | Filters (`subjectId`, `professorId`, `q`) and `page` only. Never note titles or file names |
| Data refresh | Every upload, edit, replace or delete invalidates all note lists (`['notes']`). The list of the role's subjects is loaded once per screen (`GET /college/subjects`) |

### Shared F5c parts

**`NoteCard`** (an `article`, heading level 2 = the title):
- Top line: a `FileTypeIcon` (PDF `--lx-lavender`, Word `--lx-sky`, PowerPoint `--lx-cream`, each with its `-ink`) with its text label "PDF" / "Word" / "PowerPoint" (from `file.contentType`), then the subject as a code chip + name.
- `title` (heading), then `description` as plain text (line breaks kept; clamped to 3 lines with **Show more** / **Show less** when longer).
- Facts line (muted): "{size} · Shared by {uploadedBy.fullName} · Updated {updatedAt}" (size via `formatBytes`, e.g. "2.4 MB"; "Shared by a former professor" when `uploadedBy` is `null`; date "21 Oct 2026", full date-time as `title`).
- Actions on the right from 768 px, below on phones, passed in per role.

**Open a note** (professor and student): one button whose label depends on the type. PDF: **View** opens the full-screen `PdfViewer` (as F3.6) titled with the note title. Word / PowerPoint: **Download** saves the file (`saveDownload`, the server's file name). While loading the button reads "Opening…" / "Downloading…" and is disabled; a failure shows an inline error under the card: "This file couldn't be opened. Try again." (`NOT_FOUND`: "This note no longer exists. The list has been refreshed." and the list is refetched).

**List**: newest first as returned, 20 per page, `Pagination`. Loading: 4 skeleton cards. Refetch: previous cards stay with `aria-busy`. The result count is in a polite live region ("12 notes").

**File field** (upload and replace): `FileDropzone` with `accept=".pdf,.docx,.pptx"`, prompt "Choose a file or drop it here", hint "PDF, Word (.docx) or PowerPoint (.pptx), up to 20 MB." Checked on choosing, before any request:

| Problem | Message under the field |
|---|---|
| Extension not `.pdf`, `.docx` or `.pptx` (also `.doc`, `.ppt`, `.docm`, `.pptm`) | Choose a PDF, Word (.docx) or PowerPoint (.pptx) file. |
| Larger than 20 MB | This file is {size}. Files can be at most 20 MB. |
| Empty file | This file is empty. |
| First bytes don't match the extension (`%PDF-` for PDF, `PK\x03\x04` for Word/PowerPoint) | This doesn't look like a real {PDF / Word / PowerPoint} file. |
| Server `INVALID_FILE` | This file can't be used: {server reason, without the `file:` prefix} (e.g. "must not contain macros", "must not be password-protected", "is not a readable DOCX") |
| Server `VALIDATION_ERROR` `file: is larger than the upload limit` | This file is too large. Files can be at most 20 MB. |

### F5c.3 Professor notes — `/professor/notes`

**Purpose:** share and manage study notes for the subjects you teach. Data: `GET /college/subjects` (the caller's mapped subjects), `GET /professor/notes?subjectId=&page=`, the writes in §11c.1. Template: List, wide. Eyebrow "Teaching"; H1 **Study notes**; intro (muted) "Notes you share here are visible to every student at your college."

**Header actions:** **Upload note** (primary). Disabled with the hint "You aren't assigned to any subjects yet." when the subjects list is empty.

**Filter:** Subject select, "All my subjects" + each subject as "{code} · {name}". A `subjectId` in the URL that isn't in the list, or a `404` from the list call: in place of the list, "You no longer teach this subject, or it was removed." + **Show all subjects**.

**Cards:** all notes of the caller's subjects, any uploader. On notes where `uploadedBy?.id` is the caller: **View/Download** · **Edit** · **Replace file** · **Delete** (the last three in a `RowMenu` "More actions for {title}" below 768 px). On colleagues' notes only **View/Download**, and the facts line reads "Shared by {name}".

**Empty states**
- No subjects: "You aren't assigned to any subjects yet. Your college admin assigns subjects to professors."
- No notes at all: "No notes yet. Share lecture slides, handouts or reading lists with your students." + **Upload note**.
- No notes for the chosen subject: "No notes for {code} yet." + **Upload note** (subject pre-filled).

**Upload note** (`DialogForm`, title "Upload a note"):
- Subject (select, required; pre-filled from the filter; "Choose a subject."), Title (required, 1–200 after trimming; "Enter a title." / "Titles can be at most 200 characters."), Description (optional textarea, ≤ 2,000 with a counter; "Descriptions can be at most 2,000 characters."), File (the file field above; "Choose a file.").
- **Cancel** · **Upload** ("Uploading… {n}%" with a progress bar, `aria-valuenow`). While uploading, **Cancel** becomes **Stop upload**, which aborts the request; the dialog stays open with "Upload stopped." and the fields kept.
- Closing with anything entered asks "Discard this note?" ("Your title, description and file will be lost." **Keep editing** · **Discard**).
- `201`: the dialog closes, toast "'{title}' shared with students.", the list refetches (the new note is first).
- Errors: field errors from `VALIDATION_ERROR` paths (`subjectId`, `title`, `description`); `INVALID_FILE` under the file; `404` (the subject was unmapped or deleted meanwhile): form banner "You can't share notes for this subject any more." and the subjects list refetches.

**Edit** (`DialogForm`, title "Edit note"): Title and Description as above, pre-filled. **Cancel** · **Save changes** ("Saving…"). `200`: toast "Note updated." A `404`: banner "This note no longer exists, or you no longer teach its subject. The list has been refreshed." and the list refetches. Unsaved-changes prompt as above.

**Replace file** (`DialogForm`, title "Replace the file of '{title}'"): body "Students get the new file straight away. The current file ({originalFilename}, {size}) is deleted." The file field; **Cancel** · **Replace file** (progress as for upload). `200`: toast "File replaced." Errors as for upload.

**Delete** (`ConfirmDialog`): title "Delete '{title}'?"; body "Students lose access to this file. This can't be undone."; **Cancel** · **Delete note** (danger, "Deleting…"). `204` or `404`: toast "Note deleted.", the list refetches.

### F5c.4 Student notes — `/student/notes`

**Purpose:** open the notes your professors have shared. Data: `GET /college/subjects` (all the college's), `GET /student/notes?subjectId=&q=&page=`, `GET /student/notes/{id}/file`. Template: List, standard width, mobile first. Eyebrow "My studies"; H1 **Study notes**.

**Filters:** Subject select ("All subjects" + "{code} · {name}") and a search box ("Search notes", placeholder "Search titles and descriptions", `maxLength` 100, debounced 300 ms). Both reset the page. **Clear filters** when either is set.

**Cards:** the shared `NoteCard` with **View** (PDF) or **Download** (Word, PowerPoint) only.

**Empty states:** none at all: "Your professors haven't shared any notes yet."; filtered: "No notes match these filters." + **Clear filters**. A `subjectId` of another college returns an empty page, so it shows the filtered empty state.

**Phone (390 px):** filters stacked full width; cards full width with the open button full width under the facts line.

### F5c.5 College notes — `/college/notes` (C_ADMIN)

**Purpose:** see what's shared at your college and remove what shouldn't be there. Data: `GET /college/subjects`, `GET /college/users?role=C_PROFESSOR&size=100&sort=fullName,asc`, `GET /college/notes?subjectId=&professorId=&page=`, `DELETE /college/notes/{id}`. Template: List, wide. Breadcrumb "College / Study notes"; eyebrow "College"; H1 **Study notes**; intro (muted) "Notes professors have shared with your students. You can remove a note, but only professors and students can open the files."

**Filters:** Subject ("All subjects" + "{code} · {name}") and Professor ("All professors" + names). A filter id that answers `404` (removed subject or professor): "This subject or professor no longer exists." + **Clear filters**.

**List:** a table from 768 px, caption "Study notes": Title (with the description's first line, muted) · Subject (code chip) · Shared by ("Former professor" when `null`) · Type ("PDF" / "Word" / "PowerPoint") · Size · Updated · actions (**Delete**). Cards below 768 px with the same facts. No View or Download.

**Delete** (`ConfirmDialog`): title "Delete '{title}'?"; body "Shared by {name} for {subject code}. Students lose access to this file. This can't be undone." ("Shared by a former professor …" when `null`); **Cancel** · **Delete note**. `204` or `404`: toast "Note deleted.", refetch.

**Empty states:** none: "No professor has shared notes yet."; filtered: "No notes match these filters." + **Clear filters**.

### F5c.7 Subject delete and detail (change to F2.7)

- Subject detail: a **Study notes** link next to the facts ("Study notes →", → `/college/notes?subjectId={id}`).
- Delete: when `assessmentCount` > 0 the F2.7 dialog stays as written. When `assessmentCount` is 0 and the delete answers `409 SUBJECT_IN_USE`, the subject has notes: title "{name} can't be deleted"; body "Professors have shared study notes for it. Delete the notes first, or rename the subject instead."; buttons **Close** · **View notes** (→ `/college/notes?subjectId={id}`) · **Rename**.

### F5c audit summaries

| Action | Summary |
|---|---|
| `NOTE_UPLOADED` | Note {fileName} shared |
| `NOTE_REPLACED` | Note file replaced with {fileName} |
| `NOTE_DELETED` | Note {fileName} deleted |

`details` hold only `subjectId` and `fileName` (never content); entity `SUBJECT_NOTE`. Metadata edits aren't audited.

### F5c errors (beyond §0.6)

| Error | Where | Copy |
|---|---|---|
| `INVALID_FILE` | Under the file field | This file can't be used: {server reason} |
| `VALIDATION_ERROR` `file: is larger than the upload limit` | Under the file field | This file is too large. Files can be at most 20 MB. |
| `NOT_FOUND` on upload | Form banner; subjects refetched | You can't share notes for this subject any more. |
| `NOT_FOUND` on edit, replace or delete | Banner or toast; list refetched | This note no longer exists, or you no longer teach its subject. The list has been refreshed. |
| `SUBJECT_IN_USE` with no assessments | Subject delete dialog | See F5c.7 |

---

## F5–F8 (not yet written)

Each stub lists what the section must cover. Task IDs are the plan's.

**F5 — AI evaluation UI** (contract §11; on hold with backend Phase 5): F5.1 AI Evaluate gating · F5.2 polling · F5.3 AI suggestion and flag chips · F5.4 failure and retry · F5.5 grid statuses and the AI usage tab.

**F8a — Trial, plans & billing** (contract §14): F8a.3 access banner · F8a.4 `PlanGate` · F8a.5 plans (Buy → `PAYMENTS_UNAVAILABLE`) · F8a.6 billing and cancel auto-renew · F8a.7 SUPERADMIN plans and subscriptions (grant, revoke).

**F6a — C_ADMIN analytics** (contract §12a): F6a.2 overview with "Updated {asOf}" · F6a.3 assessments table · F6a.4 non-submitters and CSV · F6a.5 Sync button (running, failed, cooldown).

**F6a-2 — Rankings & statistics** (contract §12): F6.1 ranking table · F6.2 subject picker per role · F6.3 per student · F6.4 freshness from `generatedAt`.

**F7 — Solo AI practice** (contract §13, to be revised): F7.1 plan gate (`PlanGate`) · F7.2 usage meter (`resetsAt`) · F7.3 generate question · F7.4 attempts · F7.5 generated answer · F7.6 history · F7.7 SUPERADMIN subjects · F7.8 Home card.

**F8b — Gateway checkout & hardening**: F8b.1 checkout and the "confirming payment" state.

---

## Open questions

| # | Question | Proposed answer | Affects |
|---|---|---|---|
| U1 | Library sub-nav (Bare Acts · Case Laws · Search) for roles with a single Library nav item | As specified in F0.3 | F0.3 |
| U2 | Is a typed temporary password for college admins final (contract O1)? | Yes, with **Generate** and a one-time share step | F1.6 |
| U3 | Should college admins see `LOGIN_FAILED` entries (they reveal identifiers people tried)? | Settled by P1: each entry carries the matched account's college, so a C_ADMIN sees failed sign-ins on their college's accounts. Identifiers that match no account have no college | F1.10 |
| U4 | Edit act before `GET /admin/acts/{id}` exists | Closed: the endpoint is LIVE since P1 | F1.7 |

---

## Changelog

| Date | Change |
|---|---|
| 2026-10-13 | First version: shared conventions, Phase 0 and Phase 1 |
| 2026-10-13 | Aligned with `Lexly-Frontend-Implementation-Plan.md`: plan task IDs; plan routes (`/admin/**`, `/student`, `/admin/audit`, `/college/audit`); role nav with Library; `/practice` kept as a placeholder; Home cards hidden, not deleted; bulk import moved to F1.9; college detail tabs; error copy from plan §3.6. Added F0.3 navigation and NotFound, F1.7 acts and sections admin, F1.8 case-law linking |
| 2026-10-13 | Synced with backend Phase 0 and Phase 1: no legacy role mapping; P1 endpoints marked LIVE (Edit act and the section editor load the admin GETs); change-password server messages; bulk-import `400` cases and the unknown-act case; audit summaries match the recorded `details`; `RATE_LIMITED` raised only from P8; U3 and U4 closed |
| 2026-10-14 | F2 written against backend Phase 2 (contract §8 LIVE): C_ADMIN nav and hub, users list/detail and dialogs, user import with `FileDropzone` and `CONVERTED`, subjects and professor mapping, read-only subjects on the professor and student homes, F2 error copy in §0.6, audit summaries for the P2 `details` |
| 2026-10-15 | F3 written against backend Phase 3 (contract §9 LIVE): professor list, draft editor with the publish checklist, delete/remove, assessment detail and submissions grid, student list and the answer cards with upload, submit and `PdfViewer`; F3 error copy in §0.6; F2.8 cards replaced by subject filters. F3.9 and the college Assessments tab dropped (A9 changed) |
| 2026-10-18 | F4 written against backend Phase 4 (contract §10 LIVE): grading counts and grade cells in the list, detail and grid (with the grade-status filter and grading order), answer review with the inline PDF, grade panel (draft, approve & publish, read-only once published), previous / next / next ungraded, grade history, student results per `outcome` and its entry points; `INVALID_MARKS` and `GRADE_PUBLISHED` copy in §0.6; F4 audit summaries |
| 2026-10-20 | F5a written against backend Phase 5a (contract §11a): tutor nav item for every role and the `/admin` Tutor card; the tutor screen (chat list with expiry and delete, thread with pending / failed messages, `[n]` source markers, library and `FILE` sources, not-found answers, composer, quota line and banner, disclaimer, expired conversations); tutor admin Index (re-index, latest run, polling, previous runs) and Spend (URL filters, stat tiles, SVG daily cost chart with a table) tabs; `QUOTA_EXCEEDED` (tutor), `AI_UNAVAILABLE` and `INDEX_RUN_IN_PROGRESS` copy in §0.6. F5 marked on hold |
| 2026-10-20 | UR (UI refresh) written from the approved design mock: new tokens and type (Manrope for the interface, the serif for legal text), the sidebar shell with a collapsed rail and a floating phone tab bar, the five role homes from existing endpoints (Overview, Overview, Teaching desk, My studies, Study hub), restyle rules for the other screens. Tutor failure copy split (AI_UNAVAILABLE vs maybe answered); spend tab server validation shown as bad filters |
| 2026-10-26 | F5b written against backend Phase 5b (contract §11b LIVE): `/vocab` and `/maxims` for every role, the Library sub-nav, the S_STUDENT Study hub placard and Vocab ⇄ Maxims switch, the letter bar (`#` bucket, roving focus, sideways scroll on phones), combined search and letter filters, count line, empty and error states. F5c written against backend Phase 5c (contract §11c LIVE): the sidebar / tab-bar split (D11) with the Notes items, the shared `NoteCard`, view (PDF) vs download (Word, PowerPoint), client file checks and copy, professor notes (upload, edit, replace, delete, owner-only), student notes, college notes (metadata and delete only), the subject delete and detail changes, `NOTE_*` audit summaries. `INVALID_FILE` copy for notes and `PLAN_REQUIRED` in §0.6. The F6/F8 stubs replaced by F8a, F6a (Sync), F6a-2 and F8b |
