# Lexly — Frontend Implementation Plan (lexly-webui)

**Status:** Draft for review, revised 2026-11-02 (build order set by the feature backlog; Solo practice deferred; no grant screen)
**Frontend repo:** https://github.com/LTHP1713/lexly-webui (last reviewed at `d5d52aa`, PR #7 UI refresh merged)
**Backend state (2026-11-02):** Phases 0-4, 5a, 5b, 5c, 5d, 8a and the 8b PhonePe adapter (gateway off, not yet tested against PhonePe) are merged to `lexly-backend` `main`. Phase 5 (AI grading) is on hold. Solo practice (Phase 7) is deferred. 6a (C_ADMIN analytics) isn't built.
**Frontend state:** F0-F3, F5b Done. F4, F5a and UR are merged to `master`; F4 and F5a become Done once their e2e suites are re-run against backend `main`. F5c is built on `feature/f5c-subject-notes`, not merged. F5d, F8a, F8b and F6a aren't started.
**Based on:** `Lexly-TDD.md` v2 (frozen 2026-10-12, with addenda up to 2026-10-25) and `Lexly-Implementation-Plan.md`. Request/response shapes: `Lexly-API-Contract.md`. Section references like §7.3 point to the TDD; "Phase 3" points to the backend plan.
**Contract copy:** this repo's `Lexly-API-Contract.md` was last refreshed from the backend's `docs/Lexly-API-Contract_backend.md` on 2026-10-26 (at `fbe14dd`), so it predates 5d, 8a and 8b. Refresh it before Feature 4 (§0). §12 rankings moved to P6a-2, §13 solo practice is deferred, and solo plans are superseded by §14.
**Companion docs:** `Lexly-UI-Spec.md` (layout, states and copy per screen, written per phase; sections for F5b, F5c, F8a and F6a still need writing) and `Lexly-Frontend-Status-Report.md` (what is built).
**Supersedes:** `Lexly-Frontend-Development-Master-Doc.md` §3. Its prompts target the old subscription / MCQ-practice design. Its §4 (security) and §5 (progress SOP) still apply and are summarised in §9 and §10 below.

**Rule for every frontend phase:** a phase isn't done until `npm run build` (type-check + build), `npm run lint` and `npm test` pass, and its golden path has been exercised against a running `lexly-backend` with the matching backend phase applied. A frontend phase never ships before its backend phase; until then it can be built against MSW mocks of the contract.

---

## 0. Final go-live list

**Revised 2026-11-02, checked against the code:** backend `main` at `c83aebb`, webui `master` at `4882ebd` and F5c at `5f02340`. Numbering and order follow the feature backlog in the backend's `Lexly-Implementation-Plan.md`. Lexly goes live when groups A and B are done and the checklist in §0.9 passes on staging. Days are that backlog's estimates: one developer, tests included, review and third-party waiting not included. Each item's state is **done**, **built but unmerged** or **not started**.

### 0.1 State check (2026-11-02)

| Area | Finding |
|---|---|
| F5c (PR #12) | Open and mergeable, CI green at `5f02340`. Run locally: lint clean (one older warning), build passes, 304 unit tests pass. **Not ready to merge:** no review or review comment yet, never run against a live backend, and `e2e/f5c-notes.spec.ts` (F5c.9) isn't written |
| F4 e2e | `e2e/f4-grading.spec.ts` **passed 6 of 6** on 2026-11-02: F5c build `5f02340` against backend code identical to `c83aebb` (using the backend's Supabase database, see below; that test data was removed the same day, and V23-V25 stay applied). Re-run on `master` after F5c merges to mark F4 Done |
| F5a e2e | `e2e/f5a-tutor.spec.ts` **not passed: 3 skipped**, because the AI service wasn't running. Needs the AI service on OpenAI, the backend's `LEXLY_AI_SERVICE_API_KEY`, a real re-index and paid model calls. Runs in Feature 2 |
| AI service | **OpenAI goes live (decided 2026-11-02).** The OpenAI code (`gpt-5-mini`, `text-embedding-3-small`) with the legal PDF pipeline and hybrid retrieval was reviewed and merged on 2026-11-20 (lexly-ai-service PR #3, `daf1edd`). TDD §10a, the backlog and the backend's cost rates still say Gemini |
| Running the backend | The backend's gitignored `config/application.yml` points it at **hosted Supabase** and turns on the **PhonePe sandbox**. Running it from its root, even with `docker compose up`, doesn't use local Postgres, and checkout doesn't answer `503`. Override both before any e2e run |
| Practice leftovers | `src/pages/PracticePage.tsx`; `src/App.tsx:21,146`; `src/auth/roles.ts:63,148`; `src/auth/roles.test.ts:43,104`; `src/pages/home/HomePage.tsx:157`; `src/pages/college/users/UsersImportPage.tsx:26` (says solo practice data was deleted, which is untrue); `e2e/f0-session.spec.ts:60,67-68`; UI spec lines 196-236 and the F7 stub |
| Grant leftovers | No grant code in `src/` or `e2e/`. Docs only: the F8a stub in the UI spec and the contract copy (F8a.1 in this plan is corrected). The live endpoint answers `404` |
| Billing and library notes | Not built. Only `PLAN_REQUIRED` and `RATE_LIMITED` exist in `src/api/errors.ts`, and the audit screen has no billing actions. No `access` on the session user, no `/plans`, `/billing`, `/billing/return`, `/admin/billing` or library notes screens |
| Pre-launch gaps | No analytics code anywhere. No CSP. No forgot-password or email verification endpoint or screen. No terms, privacy or refund pages. No backend Dockerfile or CI workflow. No plan has a price: `GET /billing/plans` is empty until a SUPERADMIN sets prices |

**Contract copy drift.** `docs/Lexly-API-Contract.md` is at `fbe14dd`, and the diff against the master is 126 lines. §12a is the same in both copies. Re-copy before Feature 4. These gaps affect a screen:

| Gap in the copy | Screen | Feature |
|---|---|---|
| §11d Library notes is missing | S_STUDENT list and SUPERADMIN management | 4 |
| `/library-notes/**` isn't in the gated list; the three billing codes aren't marked LIVE | `PlanGate`, Plans | 4, 5 |
| §14 is PROPOSED and says checkout is always `503` | Plans | 5 |
| The grant endpoint is still listed, and `plan: null` is described as a grant | SUPERADMIN Subscriptions, Billing | 5 |
| `GET /superadmin/billing/payments`, `resolve` and `reviewReason` are missing | SUPERADMIN Payments | 5 |
| A pass "extends from `paidUntil`" instead of starting at `max(now, trial end, paid_until)`; `/billing/me` returning a queued pass isn't described | Plans copy, Billing ("Starts…", "access until") | 5 |
| `autoRenewAvailable` is `false` with PhonePe; cancel can answer `503` | Plans, Billing | 5 |
| Minimum price 100 paise, activation rule, subscription `status` values | SUPERADMIN Plans, Subscriptions | 5 |
| Audit actions: `PAYMENT_REVIEW_*` are missing | Audit log | 5 |
| `GET /billing/payments/{id}`, `{ redirectUrl }`, `/billing/return?paymentId=` and polling the payment are missing | Checkout and return page | 6 |
| Checkout's `429`, its `403` for a converted account, and the order of its checks | Plans, Buy errors | 5, 6 |
| §13 Solo isn't marked deferred | None once Feature 3 is done | 3 |

### 0.2 Group A: must ship, buildable now, in build order

| # | Feature | Screens or work | State | Backend dependency | Days | Done when |
|---|---|---|---|---|---|---|
| 1 | Merge 8b with the gateway off | Backend only | **Done** (PR #11) | Merged | 0.25 | With `lexly.billing.gateway` blank, checkout is `503` and the reconcile job does nothing |
| 2 | Close out notes, grading and tutor | F5c: write `e2e/f5c-notes.spec.ts`, first live run, review, merge. Re-run the F4 spec on `master`. F5a: re-index and run its spec | **Built but unmerged** (F5c). F4 and F5a merged; F4 e2e passed, F5a e2e not run | 5c, 4 and 5a merged. The AI service's OpenAI code is merged (PR #3); the F5a run needs a re-index with an OpenAI key | 1-1.5 | PR #12 is reviewed and merged, and the F5c, F4 and F5a specs all pass against backend `main` |
| 3 | Remove Solo practice | Everything in the Practice row of §0.1, plus backend comments that say "Phase 7" | **Not started** | None | 0.5 | `/practice` is Not Found, no nav item or copy mentions practice, and nav tests and the F0 e2e are updated |
| 4 | Library notes (F5d) | Refresh the contract copy; write the UI spec. S_STUDENT: list, category filter, search, view and download. SUPERADMIN: upload, edit, replace, delete. Reuses F5c parts, so it follows Feature 2 | **Not started** | 5d merged | 1.5-2 | A SUPERADMIN uploads a PDF under "Torts", an S_STUDENT finds it by category and opens it, and a C_STUDENT is refused |
| 5 | Trial, plans and billing (F8a) | Write the UI spec. `src/api/billing.ts`, `access` in the session, access banner, `PlanGate` on tutor, Vocab, Maxims and library notes. `/plans`, `/billing`. `/admin/billing`: Plans, Subscriptions (revoke only), Payments review. Audit labels. Payments review marks flagged payments as refund due; the refund itself is done in PhonePe's dashboard. **No grant screen or student search** | **Not started** | 8a, 8b and grant removal merged | 3.5-4.5 | A trial shows its countdown; after it ends, gated screens show `PlanGate` while acts and case laws work; a pass bought in the trial shows "Starts {trial end}" and loses no trial days; a SUPERADMIN sets prices, revokes and resolves a flagged payment; a failed payment tells the student how a deducted amount is refunded |
| 6 | Checkout and return page (F8b.1) | Write the UI spec. Redirect to `redirectUrl`; `/billing/return` polls `GET /billing/payments/{id}`, then `/auth/refresh`. Built against mocks | **Not started** | Merged; gateway off in the default config | 1-2 | With mocks, `PAID`, `FAILED` and long `PENDING` each show the right state, the session survives the redirect, and `503`, `409` and `429` show friendly text. E2 proves it for real |
| 7 | C_ADMIN analytics (6a, F6a) | Agree contract §12a. Backend: V26, Sync, overview, assessments, non-submitters, CSV. Webui (3-4 of these days): dashboard, Sync states, filters, non-submitters, export | **Not started** | 6a not built; delivered in this item | 7-9 | After a Sync, the dashboard and CSV match the backend's hand-calculated fixture |
| 8 | Rate limits (8.3) | Backend only: register and login, uploads, AI endpoints, `Retry-After`, proxy header. The webui already maps `RATE_LIMITED` | **Not started** (checkout limit exists) | In this item | 1.5-2 | Over-limit calls answer `429` with `Retry-After`, per client behind the proxy, and the screens show friendly text |
| 9 | AI cost controls | Backend and AI service: daily spend cap with a configurable ceiling, token limits, backend cost rates changed from Gemini to the OpenAI models | **Not started** | In this item; the AI service commit is merged (PR #3) | 2-2.5 | At the ceiling, new questions are refused cleanly, and recorded cost uses the deployed model's rates |
| 10 | Paid time starts after the trial | Backend only; grants removed in the same PR | **Done** (PR #12) | Merged | 0.25 | A pass starts at `max(now, trial end, paid_until)` |
| 11 | Turn off `open-in-view` | Backend only: set it false, fix what depended on it, regression-test | **Not started** (still on by default) | In this item | 1-2 | The setting is off and the backend suite and every e2e spec pass |
| 12 | Security checks (8.4, F8b.5) | Backend: complete `AccessMatrixIntegrationTest`, dependency audit. Webui (0.5-1 of these days): CSP with the API origin as a setting, dependency audit | **Not started** (a partial matrix test exists) | In this item | 1.5-2 | Every role and endpoint is covered, no high-severity audit finding is open, and the CSP blocks nothing in the e2e runs |
| 13 | S_STUDENT account deletion | Backend: endpoint and data removal, payments kept without the user. Webui (0.5 of these days): Delete my account on Profile, with a confirm | **Not started** | In this item | 1.5-2 | The account and its data are gone, the student can't sign in, and payment rows remain with a null user |
| 14 | Object storage | Backend only: S3-API `StorageService` tested against MinIO, chosen by config, for answers and notes | **Not started** (local disk only) | In this item | 2-3 | Answer and note uploads and downloads pass against MinIO and against local disk |
| 15 | Production config and container | Backend only: CORS property, proxy headers, graceful shutdown, Dockerfile, JVM settings, storage and AI health, Redis out of liveness | **Not started** | In this item | 1.5-2.5 | The container starts on production config and its health checks report correctly with Redis down |
| 16 | CI and metrics | Backend only: build-and-test workflow, metrics endpoint | **Not started** | In this item | 1-1.5 | A backend PR runs the suite in CI, and metrics are scrapeable but not public |

### 0.3 Group B: must ship, blocked on an outside value

| # | Feature | Screens or work | State | Backend dependency | Days | Needed, and from whom | Done when |
|---|---|---|---|---|---|---|---|
| E1 | Hosting and HTTPS staging | Deploy all three services, backups and a practice restore (B5), alerts, production CORS and CSP origin | **Not started** | Features 14 and 15 | 3.5-5 | **Owner:** hosting provider and account, domain, the D6 layout (`app.` + `api.` or one origin), a Mumbai Postgres 16 database (Supabase today is Singapore, Postgres 17), a rotated Supabase password and production secrets | Staging serves the SPA and API over HTTPS, the refresh cookie works, the AI service is private, and a restore has been practised |
| E2 | Finish PhonePe (8b) | Run the sandbox checklist, including Feature 6's return page, then switch on | **Not started** (the adapter is merged with the gateway off) | 8b merged; needs E1 | 1.5-2.5 | **E1:** the HTTPS address. **Owner:** webhook set in PhonePe's dashboard. **PhonePe:** merchant onboarding and production credentials. Sandbox credentials are already in the local config | A sandbox success, failure and lost webhook each end correctly, then one real low-value payment on production credentials activates access |
| E3 | Email: verification and forgot password | Backend endpoints and contract (none exist). Webui: verify notice, forgot-password and reset screens | **Not started** | Not built; in this item | 3-4 | **Owner:** email provider, account and sending domain | A new S_STUDENT verifies their email before the trial, and a forgotten password can be reset by email |
| E4 | Legal and accounting | Three public pages, linked from Register, Plans and the footer; set the audit retention | **Not started** | None | 1.5 | **Owner or their lawyer:** terms, privacy and refund text, and a support contact. **PhonePe:** onboarding requirements. **Accountant:** how long to keep billing audit rows (30 days today). The refund text says no refunds, except that a payment deducted but failed is refunded. B10 stands: the gateway's receipt is the invoice | The approved text is live on the public URLs PhonePe checks, and retention is set |
| E5 | AI cost figures | Config only | **Not started** | Feature 9 | 0.25 | **Owner:** actual rates from OpenAI's billing (B13) and the budget figure for the ceiling (B7) | Rates and ceiling are set in production config |

### 0.4 Group C: optional after launch

| # | Feature | Screens or work | State | Backend dependency | Days | Done when |
|---|---|---|---|---|---|---|
| 17 | Rankings and per-student statistics (6a-2, F6a-2) | Ranking and per-student screens; A3 and A4 stand | **Not started** | Not built | 4-5 | Numbers match a hand-calculated fixture, ties included |
| 18 | Reassign a removed professor's assessments (A1) | C_ADMIN action | **Not started** | Not built | 1-1.5 | A C_ADMIN reassigns, and the new professor can grade |
| 19 | Month-on-month trends (B15) | Own design and storage | **Not started** | Not built | 3-4 | Trends survive a new Sync |
| 20 | AI analysis and admin chatbot (6b, F6b) | Design first; needs Feature 7 | **Not started** | Not built | 8-12 | Set when designed |
| 21 | Quality pass (F8b.2, F8b.3, F8b.7) | WCAG 2.2 AA, mobile performance, one e2e journey per role | **Not started** | None | 5-6 | AA pass recorded, performance budget met, one e2e journey passing per role |
| 22 | Dark mode (D4, F8b.4) | Token-level palette | **Not started** | None | 2-3 | Every screen passes contrast in both themes |
| 23 | More than one server instance | Jobs run on one node | **Not started** | Not built | 1-2 | Two instances run with each job firing once |
| E6 | Auto-renew | PhonePe Autopay, mandates, renewal charges, auto-renew UI | **Not started** | Not built; needs Autopay access from PhonePe | 6-10 | A mandate renews and can be cancelled |
| E8 | Frontend error monitoring (D9, F8b.6) | Redacted client error reports | **Not started** | None. Owner decided: after launch (D9). Choose the service then | 0.5 | Errors arrive with bodies and id-bearing URLs redacted |

### 0.5 Group D: deferred or out of scope

| # | Feature | Screens or work | State | Backend dependency | Days | Reason, and what would bring it back |
|---|---|---|---|---|---|---|
| E7 | AI grading (Phase 5, F5) | AI evaluate, suggestion and flags | **Not started** | On hold | 8-12 | On hold since 2026-10-19. Needs its own provider and model (B6; OpenAI is decided for the tutor), budget (B7) and 20-30 real handwritten answers |
| Phase 7 | Solo practice (F7) | None; removed by Feature 3 | **Not started**, won't be built | Not built | n/a | Deferred 2026-11-02 and depended on Phase 5. A new decision would bring it back |
| n/a | SUPERADMIN grants | None | Removed | Endpoint removed | n/a | Removed 2026-11-02: students buy their plans |
| n/a | Statutory "other laws" | None | **Not started**, not planned | Not built | n/a | Replaced by library notes (B14) |
| n/a | Notifications, including expiry reminders | None | **Not started**, not planned | Not built | n/a | TDD §1 excludes notifications. Reminders are 1 more day on E3 if that changes |
| n/a | Bare-act progress, Continue Learning, unified search | Cards stay hidden | Hidden | Not in TDD v2 | n/a | D3: flags stay off |

### 0.6 Proposed changes (nothing has been moved)

**Do E3, E4 and E8 block go-live?**

| Item | Blocks? | Why |
|---|---|---|
| E3 | **Yes.** Keep in B | No endpoint lets anyone recover an S_STUDENT password: the only resets are for college users and C_ADMINs. A paying student who forgets it is locked out for good. Without verification, any invented address gets a new trial |
| E4 | **Yes.** Keep in B | The backlog ties it to PhonePe onboarding, and Lexly shouldn't charge under a no-refund rule that isn't published |
| E8 | **No.** Keep in C | The backend decides payments and reconciles them, so a browser error can't lose one. It adds a third party. Owner decided 2026-11-02: after launch |

**Other proposals:**

1. **Move one e2e journey per role (F8b.7, part of Feature 21) into group A, and add a staging rehearsal.** Nothing in A or B currently owns the §0.9 checklist. About 2-3 days. The rest of Feature 21 stays optional.
2. ~~**Add the AI service to the backlog.**~~ **Done 2026-11-20:** the provider change was reviewed, fixed and merged (lexly-ai-service PR #3). What remains for Feature 2's F5a run is a re-index with an OpenAI key.
3. **Raise Feature 2 to about 2-3 days.** 1-1.5 doesn't cover writing the F5c e2e spec, the first live run and any fixes.
4. **Count the UI specs and contract re-copy.** The working agreement requires a spec before each phase. F5d has none, and F8a, F8b.1 and F6a are stubs. Allow about 0.25-0.5 day each for Features 4, 5, 6 and 7.
5. **Leave auto-renew out of Feature 5.** `autoRenewAvailable` is `false` with PhonePe and no `AUTO_RENEW` row can exist, so the option and Cancel auto-renew can't be reached. Move them to E6, and keep the mapper tolerant.
6. **Do E4 before E2's production step.** PhonePe onboarding needs the legal pages live. The sandbox part of E2 can stay first. E3 should also finish before production is switched on.
7. **Give the free S_STUDENT tab to Library notes.** Feature 3 frees a slot and Feature 4 needs an entry point. Billing stays on Profile and the banner (D10).
8. **Correct these docs in a follow-up, after this list is approved** (only §0 changed here):
   - This plan: header state lines, F8a.5-F8a.6 if proposal 5 is accepted, and F8b.5 and §9.7-§9.8, which mention a gateway widget (PhonePe is a redirect).
   - Backend contract master, before it is re-copied: §11d.2 says library notes aren't gated, against §14.1; §14.1 still says "or a grant"; §2.1 doesn't show `access`.
   - `CLAUDE.md`: current state, Gemini, and a warning about the backend's local config. `Lexly-Frontend-Status-Report.md` stops at 2026-10-18.
   - Backend repo: a TDD addendum and the backlog (Features 2 and 9, E4, E5) for OpenAI; Deferred Items B10 (the refund exception), B13 and D9.
9. **Flag payments that time out for refund review.** This is a gap in the owner's refund rule. An amount mismatch or an ineligible payer is flagged, but `PaymentReconcileJob` turns a payment still `PENDING` after 72 hours into `FAILED` with no flag, so a deducted amount could go unnoticed. Add a `reviewReason` for it in the backend, with the contract and the Payments review label. About 0.25 day, before Feature 5.

### 0.7 Totals

| Group | Days |
|---|---|
| **A** (all 16 items) | **27-37.5** (the backlog rounds this to 27-38) |
| A still to do (without done items 1 and 10) | 26.5-37 |
| **B** (E1-E5) | **9.75-13.25** (the backlog says about 10-13) |
| Launch total, still to do | 36.25-50.25 |

These are the backlog's figures. Proposals 1-4 and 9 would add days and aren't counted, and proposal 2's size is unknown.

### 0.8 Owner decisions and open question

**Decided 2026-11-02:**

| Topic | Decision |
|---|---|
| AI provider | OpenAI goes live for the tutor |
| Plan prices | The SUPERADMIN sets them on the Plans screen, before launch |
| Invoices (B10) | Final: the gateway's receipt is the invoice, so no GST answer is needed from the accountant |
| Refunds | A payment deducted but failed must be refunded. Otherwise no refunds. A SUPERADMIN works from the Payments review list and refunds in PhonePe's dashboard |
| Error monitoring (D9) | After launch |

**Still open:** which support address do students contact about a deducted payment? It goes on the refund page and the failed-payment message.

### 0.9 Go-live checklist per role

Run these on staging with PhonePe on, at phone and desktop widths. Every journey must work end to end.

**SUPERADMIN**
- [ ] Sign in, complete the forced password change, create a college and its C_ADMIN.
- [ ] Edit an act, a section and a case law; run a bulk import and read the per-row results.
- [ ] Upload, edit, replace and delete a library note.
- [ ] Set prices and activate plans; see them on a student's Plans page.
- [ ] Find a subscription and revoke it; the student loses access within 15 minutes. No grant action exists anywhere.
- [ ] Filter the Payments review list to Needs review, refund a flagged payment in PhonePe's dashboard, then mark it resolved.
- [ ] Re-index the tutor and see AI spend; see billing and note actions in the audit log.

**C_ADMIN**
- [ ] First sign-in with the temporary password and forced change.
- [ ] Add a user, import a CSV or XLSX and read its results, including an S_STUDENT converted to C_STUDENT whose plan ends. Reset a password.
- [ ] Create subjects and map professors; deleting a subject in use explains why it can't be deleted.
- [ ] Filter notes by subject and professor, and delete one.
- [ ] Press Sync; see the running, succeeded and cooldown states. Filter the figures, open non-submitters and export the CSV, and check them against known data.
- [ ] Read the audit log, the Library and the tutor. Another college's id shows Not Found.

**C_PROFESSOR**
- [ ] Sign in with college code and employee ID.
- [ ] Draft, publish and if needed remove an assessment.
- [ ] Follow the submissions grid; review an answer PDF, draft and approve grades question by question.
- [ ] Upload a PDF and a DOCX note, replace one and edit the other; other professors' notes offer no edit.
- [ ] Use the tutor and Library. An unmapped subject shows Not Found.

**C_STUDENT**
- [ ] Sign in with college code and roll number, and complete the forced change.
- [ ] Upload, replace and submit answers within the 5 MB and 10-page limits.
- [ ] See each mark once approved, with the others still awaiting evaluation.
- [ ] View a PDF note, download a DOCX note, search and filter.
- [ ] Use the tutor, Vocab and Maxims. No trial banner or `PlanGate` ever appears. Another college's id shows Not Found.

**S_STUDENT**
- [ ] Register, accept the terms, verify the email and see the trial countdown.
- [ ] Reset a forgotten password by email.
- [ ] Use the tutor, Vocab, Maxims and library notes during the trial.
- [ ] Buy a pass during the trial: PhonePe, return page, access shows paid, the pass shows "Starts {trial end}", access lasts until trial end plus the period, and no trial days are lost.
- [ ] Buy again while paid: the new pass starts at the current `paidUntil`.
- [ ] A failed or abandoned payment gives no access, says so and explains how a deducted amount is refunded; a slow `PENDING` lets the student leave and shows the result later in payment history.
- [ ] When the trial ends unpaid: `PlanGate` on gated screens with the typed tutor question kept, while acts, sections and case laws still work.
- [ ] Read terms, privacy and refunds from Register and Plans.
- [ ] Delete the account: sign-in fails, and the payment record is kept without the user.
- [ ] No Practice item anywhere.

---

## 1. Where the frontend is today

`lexly-webui` is a Vite + React 19 + TypeScript SPA. It uses React Router 7 (`createBrowserRouter` with a splat route around `App`, so `useBlocker` works), TanStack Query (D1), CSS Modules and no UI kit. Fonts are self-hosted: Manrope for the interface, Source Serif 4 for legal reading text.

### 1.1 Built and working

`Lexly-Frontend-Status-Report.md` has the detail. In short:

| Area | Phase | Notes |
|---|---|---|
| **Cookie session & roles** | F0, F1 | Refresh token only in the `HttpOnly` cookie; Web Lock–serialised refresh; role, college and `mustChangePassword` from `/users/me`; `RequireRole`, role homes, forced password change, two login modes |
| **Library** | pre-F0, UR | Bare-act study panel, case-law reader, search. Every role can read it |
| **SUPERADMIN** | F1, F5a | Colleges and their C_ADMINs, acts / sections / case-law admin, bulk JSON import with per-row results, audit log, tutor re-index and AI spend |
| **C_ADMIN** | F2 | Users (create, edit, reset, remove), CSV/XLSX import, subjects and the professor mapping, audit log |
| **C_PROFESSOR** | F3, F4 | Assessment drafts, publish checklist, remove, submissions grid, answer review with the PDF, draft/approve grades, grade history |
| **C_STUDENT** | F3, F4 | Assessment list and detail, per-question upload/replace/submit, results |
| **AI tutor** | F5a | `/tutor` for every role: conversations, cited answers, quota, unavailable and expired states |
| **Shell & homes** | UR | Black collapsible sidebar from 768 px, floating bottom tab bar below it, pastel placards; homes Overview / Overview / Teaching desk / My studies / Study hub |
| **Shared parts** | F0–F4 | `ConfirmDialog`, `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard`, `DataTable`, `Pagination`, `ImportResultTable`, `FileDropzone`, `StatusBadge`, `DateTimeField`, `Deadline`, `NumberField`, `PdfViewer`, `errors.ts` catalogue; `apiClient.upload` (XHR with progress) and `download` (blob + filename) |
| **Tests** | F0.6 | Vitest + Testing Library + MSW; Playwright e2e per phase with axe; CI on every PR |

### 1.2 Conventions to keep following

- `@/` → `src/`. One `src/api/<area>.ts` per backend area. DTOs are normalised by `to<Model>()` mappers: blank → `null`, missing list → `[]`. Components never see raw quirks.
- Filters, query and page live in the URL (page is 1-based in the URL, 0-based on the wire). Router state is only an optional "back to results" hint.
- One `<h1>` per screen, landmarks, `aria-live` for async results, `aria-busy` while refetching, keyboard-operable everything, and colour never the only signal.
- Loading, empty and error states exist for every card and list. One failing card never blanks a page.
- Backend `message`s are mapped to friendly text; raw bodies and stacks are never shown.
- Every task gets an entry in `docs/progress/frontend_progress.md`: date, status, what changed, how it was verified against the live backend, and notes.

---

## 2. Gap analysis

G1–G10 and G13 were closed by F0–F3 (see the progress file). Still open, and new:

| # | Gap | Action |
|---|---|---|
| G11 | Bare-Act Progress, Continue Learning, learning-activity tracking and unified `/search` aren't in TDD v2 | Keep the flags off and the cards hidden (D3) |
| G12 | Dark mode: the palette is light-only | Decide in F8b (D4) |
| G14 | The contract copy in this repo predated the 2026-10-25 roadmap (no §11b, §11c, §12a, §14) | **Closed 2026-10-26:** refreshed at `fbe14dd` |
| G15 | `FileDropzone` and the client checks accept only PDF (and CSV/XLSX for imports). Downloads are PDFs shown inline in `PdfViewer` | F5c: accept DOCX/PPTX as well, and save `attachment` downloads (DOCX, PPTX, CSV) as files instead of viewing them |
| G16 | The `SUBJECT_IN_USE` copy says only "has assessments". From P5c a subject with notes can't be deleted either | Update the copy in F5c (§3.6) |
| G17 | S_STUDENTs are never gated today. From P8a the tutor, Vocab and Maxims answer `402 PLAN_REQUIRED` once the trial has ended | `PlanGate` + access banner in F8a. F5b ships first and must already handle 402 (it falls through to a generic error until F8a) |
| G18 | `navFor` feeds both the sidebar and the tab bar, capped at 5. SUPERADMIN and C_ADMIN already have 5 items, and this revision adds Billing (SUPERADMIN) and Notes + Analytics (C_ADMIN) | Split the two lists before F5c (D11, §3.2) |
| G19 | S_STUDENT has no Library sub-nav (`hasLibrarySubNav`) and a full tab bar (Home · Bare Acts · Practice · Tutor · Profile), so the sub-nav change alone gives it no way into Vocab and Maxims | F5b.2: Study hub entry points + a Vocab ⇄ Maxims switch on both pages |

---

## 3. Target architecture

### 3.1 One SPA, role-scoped areas

Keep one app and one repo. Each role area is a lazily loaded route chunk, so a student never downloads grading code.

```
src/
├── api/                     one module per backend area: DTOs + to<Model>() mappers
│   ├── client.ts            JSON, multipart upload, blob download, refresh, cache modes
│   ├── errors.ts            error-code catalogue (§3.6)
│   ├── auth.ts users.ts content.ts caselaws.ts search.ts
│   ├── adminContent.ts adminCaseLaws.ts bulkImport.ts
│   ├── colleges.ts collegeUsers.ts subjects.ts audit.ts
│   ├── assessments.ts professor.ts student.ts grading.ts tutor.ts
│   ├── vocab.ts notes.ts billing.ts analytics.ts          new: F5b, F5c, F8a, F6a
│   └── solo.ts                                             F7
├── auth/                    session store, AuthContext, guards, roles.ts
├── components/              shell + shared UI
├── pages/
│   ├── auth/  content/  home/  tutor/    existing
│   ├── glossary/                         new (F5b): Vocab, Maxims — every role
│   ├── notes/                            new (F5c): note list, card, upload form — shared by 3 roles
│   ├── billing/                          new (F8a): S_STUDENT plans and billing
│   ├── admin/                            SUPERADMIN: content, bulk, colleges, audit, tutor, billing
│   ├── college/                          C_ADMIN: users, imports, subjects, audit, analytics
│   ├── professor/                        assessments, submissions grid, answer review
│   ├── student/                          assessments, answering, results
│   └── solo/                             S_STUDENT practice (F7)
├── hooks/  lib/  config/  dev/  test/
```

### 3.2 Roles, routing and home screens

`src/auth/roles.ts` holds the role union, each role's home and its nav items; the sidebar and tab bar render from it. `RequireRole` guards each area. A user who opens another role's URL goes to their own home. This is only a convenience; the server is the gate.

New nav items in this revision (the existing items stay as UR left them):

| Role | Adds |
|---|---|
| `SUPERADMIN` | **Billing** (F8a) |
| `C_ADMIN` | **Notes** (F5c), **Analytics** (F6a) |
| `C_PROFESSOR` | **Notes** (F5c) |
| `C_STUDENT` | **Notes** (F5c) |
| `S_STUDENT` | **Plan & billing** reached from Profile and the access banner (F8a); the tab bar stays at ≤ 5 items |

The Library sub-nav becomes **Bare Acts · Case Laws · Vocab · Maxims · Search** (F5b).

**Sidebar vs. tab bar (D11, G18).** Today `navFor(role)` is both the sidebar's list and the phone tab bar, so it can't grow past 5. Before F5c adds the first sixth item, split it in `roles.ts`: `sidebarFor(role)` lists every item (it has room), and a new `tabsFor(role)` picks at most 5. The rest are reached from the role's home placards and from related screens. Recommended tab bars:

| Role | Tab bar (≤ 5) | Sidebar only, reached from |
|---|---|---|
| `SUPERADMIN` | Colleges · Content · Billing · Tutor · Library | Audit: the Overview placard |
| `C_ADMIN` | Users · Subjects · Analytics · Tutor · Library | Notes: the Overview and the subject screens (F5c.7). Audit: the Overview |
| `C_PROFESSOR` | Desk · Assessments · Notes · Tutor · Library | — |
| `C_STUDENT` | Studies · Assessments · Notes · Tutor · Library | — |
| `S_STUDENT` | unchanged | Vocab, Maxims, Case Laws: the Study hub (F5b.2). Plans: Profile and the banner (F8a) |

`isNavItemActive` keeps working for both lists. The nav tests assert both lists per role, and that no tab bar has more than 5 items.

Route map (✅ = exists today):

```
Public        /login ✅  /register ✅
Gated         /change-password ✅                 (the only route reachable while mustChangePassword)
All roles     /acts ✅  /acts/:actId ✅  /sections/:sectionId ✅  /search ✅
              /caselaws ✅  /caselaws/:id ✅  /profile ✅  /tutor ✅  /tutor/:conversationId ✅
              /vocab  /maxims                                               (F5b)
SUPERADMIN    /admin ✅  /admin/colleges ✅  /admin/colleges/:id ✅  /admin/audit ✅  /admin/tutor ✅
              /admin/acts ✅ …  /admin/caselaws ✅ …  /admin/import ✅
              /admin/billing?tab=plans|subscriptions                        (F8a)
              /admin/solo/subjects                                          (F7)
C_ADMIN       /college ✅  /college/users ✅ …  /college/subjects ✅ …  /college/audit ✅
              /college/notes                                                (F5c)
              /college/analytics  /college/analytics/assessments/:id        (F6a)
              /college/rankings/:subjectId  /college/students/:id           (F6a-2)
C_PROFESSOR   /professor ✅  /professor/assessments ✅ …  /professor/answers/:answerId ✅
              /professor/notes                                              (F5c)
              /professor/rankings/:subjectId                                (F6a-2)
C_STUDENT     /student ✅  /student/assessments ✅ …  /student/assessments/:id/results ✅
              /student/notes                                                (F5c)
S_STUDENT     /dashboard ✅  /practice ✅(placeholder, removed by Feature 3)
              /plans  /billing                                              (F8a)
              /practice/new  /practice/questions/:id  /practice/answers     (F7)
```

`/admin/solo/plans` is dropped: billing (F8a) replaces solo plans. Routes marked (F7) are deferred; don't build them.

### 3.3 Data fetching

- TanStack Query for everything new. Query keys mirror API paths (`['college','analytics','overview',filters]`), mutations invalidate by prefix. The client's cache-mode logic (`no-cache` in dev, `reload` after logout) stays in `client.ts` underneath it.
- Polling only for in-flight work: tutor re-index (F5a), and later AI evaluation and solo `EVALUATING`. Every 3 s, backing off to 10 s, stopping on a terminal status or a hidden tab. The analytics Sync (F6a) is polled the same way while `RUNNING`.

### 3.4 Forms

Build on `Field`, the form helpers (client limits mirroring `@Size`, server `VALIDATION_ERROR` paths mapped to fields, error summary with links), `RepeatableList` and `useUnsavedChangesGuard`. No form library.

Domain inputs: `NumberField` (marks, `step="0.5"`), `DateTimeField` (ISO-8601 UTC), `FileDropzone` (client checks before upload; the server re-checks). New in this revision:
- **Note files (F5c):** PDF, DOCX or PPTX, at most 20 MB. Magic bytes are `%PDF-` for PDF and `PK\x03\x04` for DOCX/PPTX.
- **Money (F8a):** prices are integer paise; show them as `₹499` with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`; the SUPERADMIN price field takes rupees and sends paise.
- **IST dates (F6a):** analytics filters are `yyyy-MM-dd` India dates (`<input type="date">`), never converted to UTC. `asOf`, `startedAt` and `nextSyncAt` are ISO-8601 UTC instants, shown as IST date and time.

### 3.5 Files

- **Upload:** `apiClient.upload(path, formData, { method, onProgress, signal })` (XHR, no manual `Content-Type`, same 401 → refresh → retry-once rule).
- **Declared type matters (F5c):** the backend checks the part's declared content type against the file's bytes (contract §11c). Some systems give `.docx`/`.pptx` an empty `File.type`. Before appending, re-wrap such a file as `new File([file], file.name, { type })` with the type inferred from the extension. Never guess a type for any other extension.
- **View vs. save:** files come only from access-checked endpoints, so `apiClient.download(path) → { blob, filename }`. PDFs (`Content-Disposition: inline`) open in `PdfViewer`. `attachment` files (DOCX, PPTX, the analytics CSV) are saved. `download()` returns only the file name, so the caller decides from what it already knows (a note's `file.contentType`; the CSV is always saved). Saving goes through an object URL and a temporary `<a download>`, and the URL is revoked straight after. Downloads always use `cache: 'no-store'`.
- **Professor side effect:** the first `GET /professor/answers/{id}/file` sets `professor_downloaded_at`. Invalidate the answer query after the download resolves.

### 3.6 Error-code catalogue

`src/api/errors.ts` maps each `error` code to UI behaviour. Screens switch on codes, not on HTTP status. New or changed rows in this revision are marked ●.

| Code | UI behaviour |
|---|---|
| `UNAUTHORIZED` | Silent refresh once, then `/login` |
| `PASSWORD_CHANGE_REQUIRED` | Global: go to `/change-password` |
| `COLLEGE_INACTIVE` | Login banner: "Your college's account is inactive. Contact your administrator." |
| `FORBIDDEN` | "You don't have access to this page" + link to the role's home |
| `NOT_FOUND` | Not-found state. This is also the answer for out-of-scope ids, so never hint that the id exists |
| `VALIDATION_ERROR` | Map `path: reason` onto fields; otherwise a form banner |
| `EMAIL_ALREADY_EXISTS`, `SHORT_CODE_ALREADY_EXISTS`, `SECTION_NUMBER_ALREADY_EXISTS`, `COLLEGE_CODE_ALREADY_EXISTS`, `LOGIN_ID_ALREADY_EXISTS`, `SUBJECT_CODE_ALREADY_EXISTS` | Inline on the field |
| ● `SUBJECT_IN_USE` | Delete dialog explains the subject still has assessments or notes; offers rename |
| `ASSESSMENT_NOT_EDITABLE` | Refetch; editor becomes read-only |
| `ASSESSMENT_CLOSED` | Refetch; the question card shows "Closed — not attempted" |
| `ANSWER_LOCKED` | Refetch; show as submitted |
| ● `INVALID_FILE` | Inline on the dropzone. The `message` names the problem: type, size, pages, unreadable, password-protected, or (notes) "must not contain macros" |
| `GRADE_PUBLISHED` | Refetch; the grade form becomes read-only |
| `AI_EVALUATION_NOT_ALLOWED` | Inline: "Open the answer PDF first" or "Already published" (F5, on hold) |
| `INVALID_MARKS` | Inline on the marks field |
| ● `PLAN_REQUIRED` (402) | S_STUDENT only, from P8a: the gated screen (tutor, Vocab, Maxims, library notes) is replaced by `PlanGate` ("Your trial has ended…", plans link, "Check again" = `/auth/refresh` then refetch). Never a toast |
| ● `PAYMENTS_UNAVAILABLE` (503) | Plans page (F8a): "Online payment isn't available yet. Please try again later." No "contact us", because access can't be granted by hand. The Buy buttons stay, so this shows on click |
| ● `PLAN_NOT_AVAILABLE` (409) | Plans page: refetch the plans; "This plan is no longer available" |
| ● `SYNC_IN_PROGRESS` (409) | Analytics Sync (F6a): "A sync is already running"; start polling; not an error toast |
| ● `SYNC_COOLDOWN` (429) | Analytics Sync (F6a): refetch the sync state; "You can sync again at {nextSyncAt}"; not an error toast |
| `QUOTA_EXCEEDED` (429) | Tutor: disable the composer, keep the typed question, refetch `/tutor/quota`, show the banner with the local time of `resetsAt`. Solo (F7): usage banner with the reset date |
| `AI_UNAVAILABLE` (503) | Tutor: the pending message turns failed with **Try again**, keeping the question; nothing was stored or counted |
| `INDEX_RUN_IN_PROGRESS` (409) | Tutor admin: refetch the index runs and show the running one |
| `ATTEMPT_LIMIT_REACHED` | Hide upload; "3 of 3 attempts used" (F7) |
| `IMPORT_FILE_INVALID` | Whole-file error on the import screen |
| `RATE_LIMITED` (429) | Toast "Too many requests, try again shortly" (form banner on sign-in and change password); no automatic retry. Raised from P8 |
| `NETWORK_ERROR` | Retryable error state |

The exact copy for each code is in `Lexly-UI-Spec.md` §0.6. Confirm each new code's HTTP status against the live backend once per phase and record it in the progress file.

### 3.7 Styling and UX baseline

- The UR tokens (`--lx-*`), the sidebar shell and pastel placards apply to every new screen. Status colours are always paired with a text label.
- The study panel stays the reading layout for the Library. Vocab and Maxims use the Library chrome but a list layout (F5b).
- Work areas use the shared `DataTable` (sortable headers with `aria-sort`, sticky header, server pagination, filters in the URL). Student screens are mobile-first, including Notes.
- Charts are hand-drawn SVG with a data-table alternative, as in the F5a spend graph. No chart library.

### 3.8 Configuration

```
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_API_UNIFIED_SEARCH=false     # not in TDD v2 (D3)
VITE_API_LEARNING_PROGRESS=false  # not in TDD v2 (D3)
VITE_HOME_MOCKS=                  # dev only
```

No upload-limit variables: answer limits come from `uploadLimits` (contract §9.3). The 20 MB note limit and the note file types are constants in `src/api/notes.ts` citing contract §11c, because the API doesn't return them.

### 3.9 Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Mappers, error catalogue, form rules, the paise formatter, the IST date-range check, file-type inference |
| Component | Vitest + Testing Library + user-event | Forms, state machines, `PlanGate`, note-card permissions, a11y roles |
| Mocks | MSW, with handlers typed from `src/api` DTOs | Loading / empty / error / success for every screen; the only way to build F8a and F6a before their backend phases merge |
| E2E | Playwright, committed under `e2e/` | One golden path per role per phase against a live backend, at 390×844 and 1280×800, with an axe-core scan per screen |

CI: `lint → tsc -b → vitest run → vite build`.

---

## 4. Phase plan

Frontend phases mirror the backend phases. **F*n* starts once backend Phase *n*'s contract is agreed and ships after Phase *n* is merged.** The 2026-10-25 build order is the backend's: **5b → 5c → 8a → 6a**.

| Phase | Name | Backend dep | Size | State |
|---|---|---|---|---|
| F0 | Clean-up & foundations | Phase 0 | S | **Done** 2026-10-14 |
| F1 | Identity, roles, SUPERADMIN & content admin | Phase 1 | L | **Done** 2026-10-14 |
| F2 | College administration | Phase 2 | M | **Done** 2026-10-14 |
| F3 | Assessments & answering | Phase 3 | L | **Done** 2026-10-16; F3.9 dropped |
| F4 | Manual grading & student results | Phase 4 (merged) | M | Merged; Done after the e2e re-run against backend `main` |
| F5 | AI evaluation UI | Phase 5 | S | *On hold* with backend Phase 5 (2026-10-19) |
| F5a | AI legal tutor | Phase 5a (merged) | M | Merged (PR #6); Done after a re-index and `e2e/f5a-tutor.spec.ts` pass |
| UR | UI refresh | none | L | **Merged** (PR #7, 2026-10-22) |
| F5b | Vocab & Maxims | Phase 5b (merged) | S | **Done** 2026-10-26 (e2e against backend `main`) |
| F5c | Subject notes | Phase 5c (merged) | M | Built on `feature/f5c-subject-notes`; merge in Feature 2 |
| F8a | Trial, plans & billing | Phase 8a (merged) | M | Feature 5. Contract §14 LIVE |
| F6a | C_ADMIN analytics (Sync) | Phase 6a | M | Feature 7. Contract §12a PROPOSED; ship after the backend merges |
| F6a-2 | Rankings & statistics | Phase 6a-2 | M | Feature 17, optional (contract §12) |
| F6b | AI analysis & admin chatbot | Phase 6b | — | Feature 20, optional; to be designed |
| F5d | Library notes | Phase 5d (merged) | S | Feature 4. Contract §11d LIVE |
| F7 | Solo AI practice | Phase 7 | M | **Deferred 2026-11-02:** out of scope; don't build |
| F8b | Gateway checkout & hardening | Phase 8b (merged, gateway off) | M | Split across Features 6, 12, 21, 22 and E2 (see F8b below) |

Don't reopen the roadmap: Phase 5 is on hold, the tutor came first, Phase 6 is split, billing was brought forward as 8a, Solo practice is deferred, and §0 sets the build order.

---

### F0–F4, F5, F5a, UR

Done or merged. The task tables are kept in the progress file and in git history (this plan up to the 2026-10-16 revision); they aren't repeated here. Two follow-ups stay open:
- **F4:** re-run `e2e/f4-grading.spec.ts` against backend `main` and mark it Done.
- **F5a:** re-index on the live backend, run `e2e/f5a-tutor.spec.ts`, and mark it Done.

F5 (AI evaluation UI) keeps its tasks F5.1–F5.6 for when backend Phase 5 resumes: AI Evaluate button, polling, AI suggestion block with flag chips, failure + retry, grid statuses, tests.

---

### F5b — Vocab & Maxims

Backend Phase 5b (TDD §7.11, contract §11b, LIVE). Read-only glossaries for **every role**, derived from section key terms and case-law principles. No writes.

| # | Task | Details |
|---|---|---|
| F5b.1 | API module | `src/api/vocab.ts`: `VocabSummary { term, definition, source: { sectionId, sectionNumber, actId, actShortCode } }` and `MaximSummary { title, explanation, source: { caseLawId, caseTitle } }` (the backend's DTO names since `783ef11`), as `Page<T>` from `api/content`; `getVocab({ q, letter, page })` / `getMaxims(…)`. Send `letter` only when set, URL-encoded (`#` → `%23`, or the server reads an empty letter, i.e. all). Keep the server's A–Z order. The entries have **no id**: the React key is the term/title lower-cased, which is unique because the server de-duplicates on it. `queryKeys.vocab.list(params)`, `queryKeys.maxims.list(params)` with `useCachedQuery`, keeping the previous page on screen while the next one loads |
| F5b.2 | Routes and nav | `/vocab` and `/maxims`, shared routes like the Library (every role, not in `AREAS`), lazily loaded as one chunk, wide (`isWidePath`). Library sub-nav: Bare Acts · Case Laws · **Vocab** · **Maxims** · Search. **S_STUDENT (G19):** no sub-nav and a full tab bar, so the Study hub gets a Glossary placard (Vocab and Maxims links), and both pages show a small Vocab ⇄ Maxims switch (S_STUDENT only; the other roles have the sub-nav; UI spec F5b). The S_STUDENT **Bare Acts** tab stays active on these pages only if the UI spec says so (default: no tab active) |
| F5b.3 | Screen | `pages/glossary/GlossaryPage`, one component with two configs (labels, fetcher, source link). An A–Z letter bar plus `#` (anything not starting A–Z, accented letters included), with `aria-pressed` on the active letter and **All** to clear; on phones it scrolls horizontally inside its own row (no page scroll). Search box (debounced 300 ms, `maxLength` 100, matches the term/title or the meaning). `q`, `letter` and `page` (1-based) in the URL; changing `q` or `letter` resets the page. Entries as a `<dl>`: term/title, definition/explanation as plain text (no `RichText`), and a source link (`ICA · s. 2(d)` → `/sections/:sectionId`; case title → `/caselaws/:caseLawId`). Result count in an `aria-live` region; `aria-busy` while refetching. Empty states: per letter ("No terms under K") and per search ("No terms match '…'", with Clear) |
| F5b.4 | Entitlement | Prepare for P8a: a `402 PLAN_REQUIRED` from these endpoints renders `PlanGate` once F8a lands. Until then it falls through to the generic error state. Add `PLAN_REQUIRED` to `errors.ts` now so F5b and F8a share the code |
| F5b.5 | Tests | Mappers; `letter=#` sent as `%23`; letter bar keyboard use; URL round-trip; `#` bucket; search + letter combined; page reset on filter change; source links; `400 VALIDATION_ERROR` on an over-long `q` shows the form message; S_STUDENT reaches both pages from the Study hub; MSW fixtures in `src/test/glossary.ts`. E2E `e2e/f5b-glossary.spec.ts`: a term used in two sections appears once and opens the first section (by act title → section order); a maxim opens its case law |

**Done when:** every role opens Vocab and Maxims from the Library, filters by letter and searches, and each entry opens its section or case law.

---

### F5c — Subject notes

Backend Phase 5c (TDD §7.12, contract §11c). Professors share study notes (PDF, DOCX or PPTX, ≤ 20 MB) per subject. Every C_STUDENT of the college reads them, and the C_ADMIN lists and deletes them. S_STUDENTs and SUPERADMIN never see notes.

| # | Task | Details |
|---|---|---|
| F5c.0 | Nav split | D11 / G18 first: `tabsFor(role)` next to `sidebarFor(role)` in `roles.ts`, then add the Notes items. Nav tests per role |
| F5c.1 | API module | `src/api/notes.ts`: `SubjectNote { id, subject { id, code, name }, title, description \| null, file { originalFilename, contentType, sizeBytes }, uploadedBy { id, fullName } \| null, createdAt, updatedAt }` via `toSubjectNote()` (blank description → `null`). Calls: professor `listProfessorNotes({ subjectId, page })`, `uploadNote(form, { onProgress, signal })` (multipart parts `file`, `subjectId`, `title`, `description`, through `apiClient.upload`), `updateNote(id, { title, description })` (JSON `PUT`), `replaceNoteFile(id, file, …)` (multipart `PUT …/file`), `deleteNote(id)`, `downloadProfessorNote(id)`; student `listStudentNotes({ subjectId, q, page })`, `downloadStudentNote(id)`; C_ADMIN `listCollegeNotes({ subjectId, professorId, page })`, `deleteCollegeNote(id)`. The type and size constants (§3.8) and the extension → content-type inference (§3.5). `queryKeys.notes.{professor,student,college}(params)`; every write invalidates `['notes']` |
| F5c.2 | Shared note list | `pages/notes/`: a `NoteCard` (`FileTypeIcon` + "PDF / Word / PowerPoint" label, title, description as plain text, subject code · name, `formatBytes` size, uploader or "Former professor", updated date) and a paged list, newest first, as returned. One component for all three roles, with the actions passed in. Mobile-first (cards, not a table, under 768 px) |
| F5c.3 | Professor | `/professor/notes` (nav **Notes**): subject filter from `listSubjects()` (`GET /college/subjects` already returns only the caller's mapped subjects). A `subjectId` in the URL that's no longer mapped answers `404`: show the filter's Not Found state with **Show all subjects**. **Upload note** opens a dialog (`DialogForm`): subject (required; pre-filled from the filter), title (1–200, trimmed), description (≤ 2,000, optional), file, with upload progress and **Cancel** aborting the XHR. Edit (title + description) and Replace file appear only where `uploadedBy?.id === user.id`; colleagues' notes are read-only (the server answers `404` anyway). Delete confirm: "Students lose access to this file. This can't be undone." A `404` on a write (subject unmapped or deleted meanwhile) shows "This note or its subject is no longer available" and refetches. The unsaved-changes guard covers an open dialog with edits |
| F5c.4 | Student | `/student/notes` (nav **Notes**): subject filter (all the college's subjects from `listSubjects()`) and search (`q` on title and description, debounced, ≤ 100 chars), both in the URL with the page. View/download as in F5c.6. No edit actions. Optionally a "Latest notes" row on the My studies home (`size=3`) if the UI spec wants it |
| F5c.5 | C_ADMIN | `/college/notes` (sidebar **Notes**, D11): subject filter (`listSubjects()`) and professor filter (`GET /college/users?role=C_PROFESSOR&size=100&sort=fullName,asc`, a searchable select if a college has more), metadata only (**no** view or download, since the API has none), Delete with a confirm naming the note and its uploader |
| F5c.6 | Files & errors | `FileDropzone` with `accept=".pdf,.docx,.pptx"` and a `checkNoteFile()` helper: extension in the set, size ≤ 20 MB (`file: must be at most 20 MB` wording), first bytes `%PDF-` or `PK\x03\x04` matching the extension, empty `File.type` re-wrapped (§3.5). Only the zip header is checked on the client; the server checks the package (Strict Open XML is accepted since `526fd13`) and rejects macros. `INVALID_FILE` inline with the server message; the 21 MB multipart `VALIDATION_ERROR` (`file: is larger than the upload limit`) maps to the same inline error. **View vs. save:** decide from `note.file.contentType`, since `download()` returns only `{ blob, filename }`: `application/pdf` opens in `PdfViewer`, anything else goes through a new `saveDownload(download)` helper (object URL + `<a download>`, revoked at once). `SUBJECT_IN_USE` copy updated (G16) |
| F5c.7 | Subject screens | C_ADMIN subject delete dialog: on `409 SUBJECT_IN_USE`, explain that assessments or notes block deletion (the `Subject` DTO has `assessmentCount` but no note count, so this can't be predicted), and link to `/college/notes?subjectId=`. The subject detail gets a **Notes** link to the same filter |
| F5c.8 | Audit | `NOTE_UPLOADED`, `NOTE_REPLACED`, `NOTE_DELETED` (entity `SUBJECT_NOTE`) summaries in the audit screens: "Note {fileName}" from the details (`subjectId`, `fileName`; there is no subject name to show). Metadata edits aren't audited |
| F5c.9 | Tests | Each file type accepted; wrong type, > 20 MB and a renamed `.txt` → `.docx` rejected on the client; empty-`File.type` DOCX gets its type; owner-only actions; "Former professor"; upload progress and cancel; C_ADMIN has no download; PDF opens inline and DOCX is saved; another college's note id shows Not Found; nav tests for the split. MSW fixtures in `src/test/notes.ts`. E2E `e2e/f5c-notes.spec.ts`: a professor uploads a PDF and a DOCX, a student of the college views one and downloads the other, a student of another college gets Not Found, the C_ADMIN deletes one |

**Done when:** a professor uploads a PDF and a DOCX, replaces one and edits the other; a student of the college views the PDF and downloads the DOCX; the C_ADMIN filters by professor and deletes one; another college's student can't open either.

---

### F8a — Trial, plans & billing (no gateway yet)

Backend Phase 8a (TDD §7.13-7.14, contract §14, LIVE since 2026-10-28). Each new S_STUDENT gets a 3-day trial. After it ends, the tutor, Vocab, Maxims and library notes need a plan; bare acts, sections and case laws stay free. College roles are never gated. **The gateway is PhonePe (backend 8b).** Until it's configured, checkout returns `503 PAYMENTS_UNAVAILABLE`. **SUPERADMINs can't grant access (decided 2026-11-02):** a plan is only ever bought.

| # | Task | Details |
|---|---|---|
| F8a.1 | API module | `src/api/billing.ts`: `access { status: TRIAL \| PAID \| EXPIRED \| NONE, trialEndsAt, paidUntil, accessUntil }` (also on `/users/me`), `BillingPlan`, `Subscription { kind: PASS \| AUTO_RENEW, source: PAYMENT \| MANUAL, status, startsAt, endsAt, cancelAtPeriodEnd, plan \| null }`, `Payment`; paise kept as integers. S_STUDENT: `getPlans`, `getBillingMe`, `getPayments(page)`, `checkout({ planCode, autoRenew })`, `cancelSubscription(id)`. SUPERADMIN: `getAdminPlans`, `updatePlan(code, …)`, `listSubscriptions({ q, status, page })`, `revokeSubscription(id)`, `listPayments({ q, status, needsReview, page })`, `resolvePayment(id)`. No grant call: the endpoint is deleted. All `no-store` |
| F8a.2 | Access in the session | Read `access` from `/users/me` into the session user. The mapper turns a missing `access` (any backend before P8a) into `NONE`, so the gate and banner stay off and F8a can ship before 8a without breaking. After any billing change, call `/auth/refresh` and refetch `/users/me` (the token carries `accessUntil`); the existing refresh lock (`lexly-auth-refresh`) covers this call too. Revokes reach a signed-in student within the 15-minute token TTL, at the next refresh |
| F8a.3 | Access banner | S_STUDENT only, on the Study hub and gated screens: "Trial ends in 2 days" (`TRIAL`), nothing for `PAID` (except within 3 days of `paidUntil` with no auto-renew), "Your trial has ended" (`EXPIRED`) with a link to plans. Dismissible per day (a `localStorage` UI preference) |
| F8a.4 | `PlanGate` | Shown in place of a gated screen on `402 PLAN_REQUIRED`, or straight away when `access.status === 'EXPIRED'`: what the plan unlocks, a link to `/plans`, and **Check again** (refresh + refetch) for a student who has just paid. Wired into `/tutor` (both the quota and the ask: `/tutor/**` is gated, so a 402 can arrive mid-chat and the typed question is kept), `/vocab`, `/maxims` and library notes (F5d). Routes `/plans` and `/billing` join the S_STUDENT area in `AREAS` |
| F8a.5 | Plans | `/plans`: active plans (`GET /billing/plans`) as cards with period and price, pass vs. auto-renew where `autoRenewAvailable`. **Buy** calls `POST /billing/checkout`, and with no gateway configured that is `503`, which shows the "not available yet" message (§3.6); checkout itself is Feature 6. Copy: no refunds, access ends exactly at the period end |
| F8a.6 | Billing | `/billing`: current access and its end, the subscription (kind, source, `cancelAtPeriodEnd`), **Cancel auto-renew** with a confirm ("access continues until {endsAt}"), and payment history (paged). `plan` can be `null` on an older `MANUAL` row: show the dates only |
| F8a.7 | SUPERADMIN billing | `/admin/billing` (nav **Billing**). **Plans** tab: edit name, price (₹ → paise, at least 100 paise), active and auto-renew available; activation needs a price. **Subscriptions** tab: search and status filter; **Revoke** with a confirm whose text notes it takes effect within 15 minutes. **Payments** tab: `GET /superadmin/billing/payments` with search, status and a **Needs review** filter; each row shows the reason and `gatewayOrderId`, with **Mark resolved** (contract §14.4). No grant action anywhere |
| F8a.8 | Tests | Each access status and banner; `PlanGate` on a 402 and "Check again" flow; `503` on Buy; cancel auto-renew; paise formatting; review list filter and Mark resolved; college roles never see banner or gate; e2e against the 8a backend: expire a trial (backend test clock or a seeded user) and see the gate; a paid state seeded directly in the test database, then "Check again" unlocks the tutor |

**Go-live (decided 2026-10-26, confirmed 2026-11-02):** Lexly goes live only once online payment works, so students buy their own plans. The backend's grant endpoint is deleted, so there is no grant screen or student search (B9 closed). A pass bought during the trial starts when the trial ends, so `access.status` is `PAID` from the moment of payment, while `subscription.startsAt` is in the future until then: show "Starts {startsAt}".

**Done when:** an S_STUDENT on a trial sees the countdown; after it ends the tutor, Vocab, Maxims and library notes show the plan gate while bare acts and case laws still work; Buy explains that payments aren't available yet; a paid state set up in the e2e lets the student in after "Check again"; a SUPERADMIN sets prices, revokes a subscription and resolves a flagged payment.

---

### F6a — C_ADMIN analytics (Sync)

Backend Phase 6a (TDD §7.15, contract §12a, PROPOSED; changed 2026-10-26). **C_ADMIN only**; SUPERADMIN and C_PROFESSOR have no analytics screens or actions. Every number comes from the college's current snapshot, which the C_ADMIN refreshes with **Sync** (at most once per 15 minutes; a failed sync doesn't count). There is no nightly run and no SUPERADMIN trigger.

| # | Task | Details |
|---|---|---|
| F6a.1 | API module | `src/api/analytics.ts`: `getOverview(filters)`, `listAssessmentStats(filters, page)`, `listNonSubmitters(id, include, page)`, `downloadNonSubmittersCsv(id, include)`, `getSync()` and `startSync()` (§12a.5–12a.6); filters `subjectId`, `professorId`, `from`, `to` (IST `yyyy-MM-dd`, sent as typed). Percentages kept as numbers and shown with one decimal; `null` stays `null`. Filter pickers reuse `listSubjects()` and `GET /college/users?role=C_PROFESSOR`; a filter id that's no longer valid answers `404`, shown as "This subject/professor no longer exists" with **Clear filter** |
| F6a.2 | Overview | `/college/analytics` (nav **Analytics**; the Overview home can link to it). An "Updated {asOf}" line (IST date and time); when `asOf` is `null`, an empty state: "No figures yet. Press Sync to load them." Filters in the URL with `to ≥ from` checked on the client. Stat tiles from `totals` (assessments, questions, attempted questions, students, grades published, average score %). By-subject table with average % (and an optional SVG bar chart with a data-table alternative). By-professor table, where a `null` professor is "Former professor". Submission split (all / some / none) as a labelled stacked bar plus numbers. `null` averages show "—", never 0 |
| F6a.3 | Assessments | A paged table under the overview, newest published first: title, subject, professor, status, published/due dates, questions, students, submitted all / partial / none, attempted, published grades, average %. A row opens F6a.4 |
| F6a.4 | Non-submitters | `/college/analytics/assessments/:id`: tabs **All · None · Partial** (`include`), paged by name: student name, roll no, email, submitted / total. **Export CSV** downloads the CSV for the current tab through `saveDownload()` (§3.5; the file name comes from `Content-Disposition`, falling back to `non-submitters.csv`). Names, roll nos and emails stay out of the URL (§9.3); the URL holds only the assessment id, `include` and page. Another college's id → Not Found |
| F6a.5 | Sync button | On `/college/analytics`, next to the "Updated" line, from `GET /college/analytics/sync`. **Sync** (no confirm) → `POST`; while `RUNNING` the button shows a spinner and "Syncing…" and the state is polled (§3.3). `SUCCEEDED` invalidates `['college','analytics']`. `FAILED` shows "Sync failed. Showing figures from {asOf}." While `nextSyncAt` is in the future the button is disabled with "Next sync at {time}". `409`/`429` per §3.6 |
| F6a.6 | Tests | Empty (`asOf` null) state; Sync running / succeeded / failed / cooldown and the `409`/`429` handling; filter URL round-trip and the range check; Former professor row; null average; CSV download name; Not Found; non-C_ADMIN roles have no route; e2e against the 6a backend's hand-computed fixture |

**Backend asks:** none (B10 resolved 2026-10-26 by contract §12a.5).

**Done when:** a C_ADMIN presses Sync, sees the figures update with the snapshot's time, filters by subject, professor and dates, opens an assessment's non-submitters and exports them, and the numbers match the backend fixture.

---

### F6a-2 — Rankings & statistics (later)

The old F6 tasks, kept for backend Phase 6a-2 (contract §12):

| # | Task | Details |
|---|---|---|
| F6.1 | Ranking table | `GET /analytics/subjects/{id}/ranking`: rank, name, roll no, obtained / max, score %. Ties share a rank (1, 1, 3), sorted by name within a rank. Every student appears, including 0%. Client-side name search. No export |
| F6.2 | Subject picker | C_ADMIN: all subjects. C_PROFESSOR: mapped subjects only. SUPERADMIN: college, then subject |
| F6.3 | Per student | `/college/students/:id`: per subject %, rank, attempted vs. published, pending |
| F6.4 | Freshness | "Updated {time}" from the response's `generatedAt` |
| F6.5 | Tests | Ties; zero-total subject; a professor can't pick unmapped subjects; students have no ranking route |

The old F6.3 "C_ADMIN overview" is replaced by F6a.

---

### F5d — Library notes

Backend Phase 5d (TDD §7.12a, contract §11d). S_STUDENTs get a Library notes screen: category filter (from `GET /library-notes/categories`), search, PDF inline view and DOCX/PPTX download. The SUPERADMIN gets an upload/edit/replace/delete screen. Gated by `PlanGate` like Vocab and Maxims (F8a). Reuses `NoteCard`, `NoteDialogs` and `checkNoteFile()` from F5c.

---

### F7 — Solo AI practice (DEFERRED 2026-11-02)

**Out of scope: don't build this.** The tasks are kept for if it returns. Solo would use billing's entitlement instead of `solo_plans`, and contract §13 would need revising first.

| # | Task | Details |
|---|---|---|
| F7.1 | Plan gate | `/practice` uses `PlanGate` on `402` (F8a.4). The Library stays available |
| F7.2 | Usage meter | "X of 60 generations used this month · resets on {resetsAt}" on every solo screen. At 60, generate buttons are disabled; `QUOTA_EXCEEDED` shows the same banner |
| F7.3 | Generate question | `/practice/new`: subject, difficulty (`EASY / MEDIUM / HARD`), word limit (50–2000), max marks (`5 / 10 / 15 / 20 / 25`). Pending state while the AI runs |
| F7.4 | Attempts | `/practice/questions/:id`: up to 3 attempts: upload PDF → `EVALUATING` (polling) → marks, feedback, flags. A failed evaluation offers Retry and doesn't use up an attempt |
| F7.5 | Generate answer | `/practice/answers`: plain-text AI answer with paragraphs, Copy button, a general-knowledge note |
| F7.6 | History | Questions, attempts and answers from the last 30 days, each with its expiry |
| F7.7 | SUPERADMIN | `/admin/solo/subjects` (CRUD, active toggle). Plans are managed in `/admin/billing` (F8a.7) |
| F7.8 | Home | A Practice card on the Study hub |
| F7.9 | Tests | Plan gate; quota 59 → 60 → blocked; attempt limit; polling stops |

---

### F8b — Gateway checkout & hardening

The gateway is PhonePe, one-time passes only. This phase is split across the backlog: F8b.1 is Feature 6 (mocks) and E2 (real test), F8b.5 is Feature 12 with the production origin in E1, F8b.2, F8b.3 and F8b.7 are Feature 21, F8b.4 is Feature 22, and F8b.6 is E8.

| # | Task | Details |
|---|---|---|
| F8b.1 | Checkout | `POST /billing/checkout` → redirect to `checkout.redirectUrl` → PhonePe returns to `/billing/return?paymentId=…`. The return page polls `GET /billing/payments/{id}` until `PAID` or `FAILED`, then calls `/auth/refresh` on `PAID`. Don't poll `access.status`: a student renewing early is already `PAID`. It can stay `PENDING` for several minutes if a webhook is lost, so say so and let the student leave. Only the gateway decides a payment, never the return URL. `429 RATE_LIMITED` on too many checkouts |
| F8b.2 | Accessibility | WCAG 2.2 AA pass on every screen; manual keyboard and screen-reader checks on the review screen, the answer cards, the grids and the analytics tables |
| F8b.3 | Performance | Per-role chunks verified; ≤ 200 KB gzip for the initial S_STUDENT chunk (fonts included); Lighthouse on a mid-range phone profile |
| F8b.4 | Dark theme | If D4 says yes: a token-level dark palette |
| F8b.5 | Security | CSP (`default-src 'self'`, `connect-src` the API origin, `frame-src blob:` for `PdfViewer`, plus whatever the chosen gateway's widget needs, approved explicitly); dependency audit; no token, blob URL or personal data in logs; production CORS origin |
| F8b.6 | Error monitoring | Optional, after approval (D9), with request bodies and id-bearing URLs redacted |
| F8b.7 | E2E matrix | One Playwright journey per role, plus "wrong role opens URL → redirected" per area |

---

## 5. Shared component inventory

| Component | Status | First needed |
|---|---|---|
| `ConfirmDialog`, `Toast`, `Field`, `RepeatableList`, `useUnsavedChangesGuard` | ✅ | — |
| `StudyPanel` (`ReadingProgress`, `OnThisPage`, `Insights`, `DocPart`, `RichText`) | ✅ | Library |
| `LoadingState`, `ErrorState`, `NotFound`, `RequireRole`, role nav config | ✅ | — |
| `DataTable`, `Pagination`, `ImportResultTable` | ✅ | — |
| `FileDropzone` + upload progress | ✅ PDF, CSV/XLSX; DOCX/PPTX in F5c | F5c |
| `StatusBadge`, `DateTimeField`, `Deadline`, `NumberField`, `PdfViewer` | ✅ | — |
| Stat tiles and the SVG bar chart + data table | ✅ in `pages/admin/tutor/` (`SpendTab`, `SpendChart`); move to `src/components/` when F6a reuses them | F6a |
| `tabsFor()` in `roles.ts` (tab bar ≤ 5, separate from `sidebarFor()`) | new | F5c (D11) |
| `LetterBar` (A–Z + `#`) | new | F5b |
| `NoteCard`, `FileTypeIcon`, `saveDownload()` helper | new | F5c |
| `AccessBanner`, `PlanGate`, `PlanCard`, `formatPaise()` | new | F8a |
| `StackedBar` (submitted all / some / none) | new | F6a |
| `RankingTable` | new | F6a-2 |
| `AiSuggestion`, `AiFlagChips` | new | F5 / F7 |
| `UsageMeter` | new | F7 |

---

## 6. Backend asks

"LIVE" means implemented. B1–B8 are unchanged from the 2026-10-16 revision. These B-numbers are this plan's asks and are unrelated to the backend's `Lexly-Deferred-Items.md` B-items (whose B9 and B10 are plan prices and renewals); the latter are always written "Deferred B*n*". B10 was resolved on 2026-10-26: the backend dropped the SUPERADMIN snapshot trigger, and the C_ADMIN's Sync has its own status endpoint (contract §12a.5). B9 is deferred: payments come before go-live (2026-10-26).

| # | Ask | Needed by | Status |
|---|---|---|---|
| B1 | `GET /users/me` adds the college and `mustChangePassword` | F1 | **LIVE (P1)** |
| B2 | `POST /auth/change-password` returns a new access token and rotates the cookie | F1 | **LIVE (P1)** |
| B3 | CORS exposes `Content-Disposition` | F3 / F8b | **LIVE (P3)**; production origin open (D6) |
| B4 | Upload limits exposed | F3 | **LIVE (P3)** `uploadLimits` for answers. Notes (F5c) use the contract's fixed 20 MB instead |
| B5 | Agreed response shapes per phase | each phase | In contract |
| B6 | Every list endpoint is a `PagedResponse` with server-side filters | all | In contract §0.4 |
| B7 | Confirm the HTTP status of each new error code in §3.6 | each phase | New in this revision: `PLAN_REQUIRED` 402, `PAYMENTS_UNAVAILABLE` 503, `PLAN_NOT_AVAILABLE` 409, `SYNC_IN_PROGRESS` 409, `SYNC_COOLDOWN` 429 |
| B8 | Sort `GET /acts/{id}/sections` by natural order on the server | any | Contract §3.2; verify live |
| B9 | SUPERADMIN needs a way to find an S_STUDENT **without** a subscription to grant them access | F8a | **Closed 2026-11-02:** SUPERADMINs don't grant access to S_STUDENTs |
| ~~B10~~ | ~~SUPERADMIN can start a snapshot but can't see whether it finished or failed~~ | F6a | **Resolved 2026-10-26:** the nightly run and the SUPERADMIN trigger are dropped; the C_ADMIN syncs and `GET /college/analytics/sync` gives the status (contract §12a.5) |

---

## 7. Decisions to make

| # | Decision | Recommendation |
|---|---|---|
| D1 | Data-fetching library | **Done:** TanStack Query (F2) |
| D2 | Separate `lexly-webui` repo | Keep it. One SPA with per-role chunks |
| D3 | Bare-Act Progress, Continue Learning and unified search | Hidden; revisit after F8b |
| D4 | Dark mode | Light-only until F8b |
| D5 | Upload limits | **Decided:** answers 5 MB / 10 pages (`uploadLimits`); notes 20 MB, PDF/DOCX/PPTX (2026-10-25) |
| D6 | Production domains | SPA and API same-site (e.g. `app.` + `api.` subdomains) or one origin behind a reverse proxy, so the `SameSite=Lax` refresh cookie keeps working |
| D7 | CSV/XLSX templates | **Decided** with backend Phase 2 |
| D8 | Payment gateway | **Decided 2026-10-28: PhonePe** (backend Deferred B8). Testing needs a deployed HTTPS address (E2) |
| D9 | Client error monitoring | Only with redaction and explicit approval |
| D10 | Where S_STUDENTs reach Plan & billing on mobile, given the ≤ 5-item tab bar | From Profile and the access banner, with no new tab (recommended) |
| D11 | How roles with more than 5 nav items fit the phone tab bar (G18) | **Decided 2026-10-26:** split the sidebar list (all items) from the tab bar (≤ 5, chosen per role, §3.2); the rest from the home placards. Done first in F5c (F5c.0). S_STUDENTs reach Vocab and Maxims from a Study hub placard plus a Vocab ⇄ Maxims switch, with the tab bar unchanged (G19) |

---

## 8. Immediate next steps

Follow §0 from the top: merge F5c and re-run the F4 and F5a e2e suites, then remove Solo practice.

---

## 9. Security rules (frontend)

1. The access token is held in memory only; the refresh token exists only in the `HttpOnly` cookie. No auth data in Web Storage. `localStorage` holds only UI preferences: the cache-bypass timestamp, the login tab name, the sidebar state and (F8a) the access-banner dismissal date.
2. Render all backend text as plain text, including vocab definitions, maxim explanations, note titles and descriptions, and AI output. The only markup parsing is `HighlightedSnippet` and the study panel's `RichText`, both built from text nodes. Never use `dangerouslySetInnerHTML`.
3. Student answers, feedback, marks and the non-submitter lists are personal data. Keep them out of URLs, logs, analytics and error tracking. URLs carry ids, never names, roll numbers or emails. The non-submitters CSV is downloaded, never cached.
4. Revoke object URLs (PDF views and saved downloads) as soon as they're no longer needed. Never cache answer or note files (`cache: 'no-store'`, no service worker).
5. A 404 for another college's or professor's resource is shown as Not Found, never as "no access".
6. Role checks, owner-only note actions and the plan gate in the UI are only for convenience; the server enforces access.
7. No payment card data ever touches Lexly's UI; checkout (F8b) happens in the gateway's own widget.
8. No new third-party script or network origin without approval; audit each new dependency. The gateway widget's origin is added only in F8b, once approved.

---

## 10. Working agreement

- **Progress:** `docs/progress/frontend_progress.md`, using this plan's task IDs (e.g. "F5c.3 Professor notes"). Each entry has the date, status, what changed, verification (live backend or mocks, plus which checks), and notes.
- **Gate:** a task is Done only when its backend counterpart is merged and the task has been exercised against the live backend.
- **Commits:** Conventional Commits (`feat(notes): professor note upload`), one commit per task or small group of tasks, a branch per phase cut from an up-to-date `master`, never directly to `master`.
- **Session start:** read the progress file and this plan, check the backend phase status, then continue from the In Progress / Blocked notes.
