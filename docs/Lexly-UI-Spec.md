# Lexly — UI Spec (web)

**Status:** Draft, revised 2026-10-13. F0 and F1 written; F2–F8 not yet written.
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
| Student assessment and answer cards (F3.6) | — | Needed before F3 |
| Professor answer review (F4.1, F4.2) | — | Needed before F4 |

---

## Contents

- [0. Shared conventions](#0-shared-conventions)
- [Phase index](#phase-index)
- [F0 — Clean-up & foundations](#f0--clean-up--foundations)
- [F1 — Identity, roles, SUPERADMIN & content admin](#f1--identity-roles-superadmin--content-admin)
- [F2–F8 (not yet written)](#f2f8-not-yet-written)
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
| `RATE_LIMITED` | Toast; the form banner on sign-in and change password | Too many requests, try again shortly. No automatic retry |
| `PASSWORD_CHANGE_REQUIRED` | — | No message. Go to `/change-password` (F1.2) |
| `COLLEGE_INACTIVE` | Login screen banner | Your college's account is inactive. Contact your administrator. |
| `EMAIL_ALREADY_EXISTS` | Field `email` | This email is already used by another Lexly account. |
| `SHORT_CODE_ALREADY_EXISTS` | Field `shortCode` | Another act already uses this short code. |
| `SECTION_NUMBER_ALREADY_EXISTS` | Field `sectionNumber` | This act already has a section with this number. |
| `COLLEGE_CODE_ALREADY_EXISTS` | Field `code` | Another college already uses this code. |
| `LOGIN_ID_ALREADY_EXISTS`, `SUBJECT_CODE_ALREADY_EXISTS` | Field | Written in F2 |
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

Until backend Phase 1 ships, `ADMIN` maps to the SUPERADMIN area and `STUDENT` / `LAWYER` to S_STUDENT (F0.3).

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
| F2 | College administration | Not yet | — |
| F3 | Assessments & answering | Not yet | — |
| F4 | Manual grading & student results | Not yet | — |
| F5 | AI evaluation UI | Not yet | — |
| F6 | Rankings & statistics | Not yet | — |
| F7 | Solo AI practice | Not yet | — |
| F8 | Payments & hardening | Not yet | — |

F0.2, F0.4–F0.7, F1.3 and F1.11 have no screens of their own.

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

Content admin routes (`/admin/**`) accept `SUPERADMIN` (and `ADMIN` until Phase 1).

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

**Server errors:** `currentPassword: is incorrect` → field error "Your current password is incorrect." Other paths → under their field. `RATE_LIMITED` → form banner.

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

Placeholders use the `SimplePage` panel style. The legacy role mapping from F0.3 is removed.

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

**Tabs** (URL `?tab=`): **Admins** (F1) · **Assessments** (F3.9) · **AI usage** (F5.5). Only tabs whose phase has shipped are shown. A link "Audit log for this college" → `/admin/audit?collegeId={id}`.

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

Edit loads `GET /admin/acts/{id}` (contract: ADDED, P1) because `GET /acts` has no `description` and `PUT` replaces it. **Until that endpoint exists, Edit is not offered**; Add and Delete work. Toasts: "Act added." / "Act updated."

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
**Data:** loads `GET /admin/sections/{id}` (ADDED, P1). Until that exists it loads the public `GET /sections/{id}`, which has the same fields; list order stands in for `displayOrder`.
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
| `400` (envelope invalid) | Banner with the server message; no results |
| All created | Summary in the success colour; toast "{n} items imported." |

### F1.10 Audit log

**Routes:** `/admin/audit` (SUPERADMIN, all colleges) and `/college/audit` (C_ADMIN, own college). Data: `GET /audit` (contract §7). Template: List, wide.

**Filter bar**

| Filter | Param | Notes |
|---|---|---|
| College | `collegeId` | SUPERADMIN only. Searchable select, plus "All colleges" |
| Action | `action` | Select with the labels below |
| From / To | `from`, `to` | Date inputs. Sent as the start of the `from` day and the start of the day **after** `to` (local time), because `to` is exclusive. Default: the last 7 days |

Under the filters, muted: "Entries are kept for 30 days."

**Table (≥ 1024px):** When (`createdAt`) · Who (`actor.fullName` + role label; "System" when `actor` is null) · College (`college.code`; SUPERADMIN only) · Action (label) · Entity (`entityType`, humanised: "User", "Subject"…) · Details (one-line summary).
**Cards (< 1024px):** action label as heading; "{who} · {when}"; college code; summary.

Clicking a row expands it to show `details` as text: a key–value list with humanised keys (`rejected` → "Rejected"), nested values as indented JSON text. Never HTML.

| `action` | Label | Summary (when `details` has the fields) |
|---|---|---|
| `LOGIN_FAILED` | Failed sign-in | Identifier tried |
| `PASSWORD_RESET` / `PASSWORD_CHANGED` | Password reset / Password changed | Whose password |
| `COLLEGE_CREATED` / `COLLEGE_UPDATED` | College added / College updated | Code; "Deactivated" / "Activated" when `active` changed |
| `USER_CREATED` / `USER_UPDATED` / `USER_REMOVED` | User added / updated / removed | Name and role |
| `USER_IMPORT` | Users imported | "{created} created, {converted} converted, {rejected} rejected, {failed} failed of {total}" |
| `CONTENT_IMPORT` | Content imported | Same pattern |
| `SUBJECT_CREATED` / `_UPDATED` / `_DELETED` | Subject added / updated / deleted | Subject code |
| `SUBJECT_PROFESSORS_CHANGED` | Subject professors changed | Subject code |
| `ASSESSMENT_PUBLISHED` / `ASSESSMENT_REMOVED` | Assessment published / removed | Title |
| `AI_EVALUATION_REQUESTED` | AI evaluation requested | — |
| `GRADE_EDITED` / `GRADE_PUBLISHED` | Grade edited / published | — |
| `SOLO_PLAN_CHANGED` / `SOLO_QUOTA_RESET` | Solo plan changed / Solo quota reset | — |

Unknown actions show the raw code in monospace, so a new backend action never breaks the page. Missing summary fields show "—".

| State | Copy |
|---|---|
| Empty, default filters | "Nothing has been recorded in the last 7 days." |
| No matches | "No entries match these filters." + **Clear filters** |

---

## F2–F8 (not yet written)

Each stub lists what the section must cover. Task IDs are the plan's.

**F2 — College administration** (contract §8): F2.2 user list (Students / Professors tabs) · F2.3 create/edit user · F2.4 reset password confirm · F2.5 remove user (typed confirmation, per-role consequences) · F2.6 bulk import (template download, `FileDropzone`, `ImportResultTable` with `CONVERTED`, `IMPORT_FILE_INVALID`) · F2.7 subjects and professor mapping, `SUBJECT_IN_USE` · F2.8 read-only subject lists.

**F3 — Assessments & answering** (contract §9): F3.1 professor list · F3.2 draft editor · F3.3 publish checklist and confirm · F3.4 delete/remove · F3.5 student list by state · **F3.6 student assessment with per-question answer cards** (every `answer.status` × assessment state; countdown corrected with `serverTime`; `INVALID_FILE`, `ANSWER_LOCKED`, `ASSESSMENT_CLOSED`) · F3.7 upload with progress · F3.8 submissions grid · F3.9 SUPERADMIN read-only tab.

**F4 — Manual grading & results** (contract §10): **F4.1/F4.2 professor answer review and grade panel** (PDF, marks, feedback, save draft, approve & publish, `INVALID_MARKS`, `GRADE_PUBLISHED`) · F4.3 previous / next / next ungraded · F4.4 grade history (always returned) · F4.6 student results per `outcome`.

**F5 — AI evaluation UI** (contract §11): F5.1 AI Evaluate gating · F5.2 polling · F5.3 AI suggestion and flag chips · F5.4 failure and retry · F5.5 grid statuses and the AI usage tab.

**F6 — Rankings & statistics** (contract §12): F6.1 ranking table · F6.2 subject picker per role · F6.3 C_ADMIN overview · F6.4 per student · F6.5 freshness from `generatedAt`.

**F7 — Solo AI practice** (contract §13): F7.1 plan gate · F7.2 usage meter (`resetsAt`) · F7.3 generate question · F7.4 attempts · F7.5 generated answer · F7.6 history · F7.7 SUPERADMIN subjects and plans · F7.8 Home card.

**F8 — Payments & hardening** (contract §14): F8.1 checkout and the "confirming payment" state.

---

## Open questions

| # | Question | Proposed answer | Affects |
|---|---|---|---|
| U1 | Library sub-nav (Bare Acts · Case Laws · Search) for roles with a single Library nav item | As specified in F0.3 | F0.3 |
| U2 | Is a typed temporary password for college admins final (contract O1)? | Yes, with **Generate** and a one-time share step | F1.6 |
| U3 | Should college admins see `LOGIN_FAILED` entries (they reveal identifiers people tried)? | Yes, for their own college | F1.10 |
| U4 | Edit act before `GET /admin/acts/{id}` exists | Not offered until the endpoint ships | F1.7 |

---

## Changelog

| Date | Change |
|---|---|
| 2026-10-13 | First version: shared conventions, Phase 0 and Phase 1 |
| 2026-10-13 | Aligned with `Lexly-Frontend-Implementation-Plan.md`: plan task IDs; plan routes (`/admin/**`, `/student`, `/admin/audit`, `/college/audit`); role nav with Library; `/practice` kept as a placeholder; Home cards hidden, not deleted; bulk import moved to F1.9; college detail tabs; error copy from plan §3.6. Added F0.3 navigation and NotFound, F1.7 acts and sections admin, F1.8 case-law linking |
