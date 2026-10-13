# Lexly Frontend (lexly-webui) — Progress

## Completed

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

_Nothing in flight._

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
on `feature/phase1`. The current UI breaks on that backend (roles renamed; gated accounts get
`403 PASSWORD_CHANGE_REQUIRED`), so the role and password-change work comes first.

1. **F0 on `feature/f0-cleanup`**, with F1.2 pulled in:
   - F0.2 Role from `/users/me` after every login (drop `roleFromAccessToken`); five roles only.
   - F0.3 `roles.ts`, `RequireRole`, role-driven nav with Library and Content sub-navs, NotFound
     page, lazy areas.
   - F1.2 `/change-password`, forced and voluntary; switch to the returned access token.
   - F0.1 Remove MCQ practice: `PracticeProgress`, the `practiceStats` flag, its DTOs and mocks;
     `/practice` becomes the "Solo practice — coming soon" placeholder; hide the Bare-Act Progress
     and Continue Learning cards (D3).
   - F0.4 Move the shared components from `pages/admin/` to `src/components/`.
   - F0.5 Client: `FormData`, `patch`, `upload`, `download`, `AbortSignal`, `errors.ts`.
   - F0.6 Vitest, Testing Library, MSW, Playwright, axe, CI workflow.
   - F0.7 Re-run the 2026-10-09 cookie checks against the live backend; fix the in-flight-refresh
     sign-out (G10).
2. **F1 on `feature/f1-identity`:** F1.1 two-mode login, F1.4 role homes, F1.5 Profile, F1.6
   colleges + C_ADMINs, F1.10 audit log, then F1.7 acts & sections admin, F1.8 case-law linking,
   F1.9 bulk import (per-row shape), F1.11 tests. Ship after `feature/phase1` merges.
3. Write the F2 UI spec before Phase 2 starts.
4. Later (D4): choose an app-wide dark-mode approach.
