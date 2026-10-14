# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`lexly-webui`: the React web frontend for Lexly, a law intelligence platform (bare acts and sections, case laws, and the planned college assessments with AI grading). It is a Vite + React 19 + TypeScript SPA with React Router 7 and CSS Modules, and no UI kit. Its only runtime dependencies are React, the router and the self-hosted Source Serif 4 font. It talks to the Spring Boot backend `lexly-backend` (separate repo, locally at `C:\LIS\Lexly`) at `http://localhost:8080/api/v1`.

## Commands

```bash
npm install
cp .env.example .env    # first time only
npm run dev             # http://localhost:5173 (the only origin the backend's CORS allows)
npm run build           # tsc -b type-check + vite build — the main correctness check
npm run lint            # oxlint (.oxlintrc.json)
npm run preview
```

- There are no automated tests yet. Vitest + Testing Library + MSW + Playwright are planned (plan F0.6). Until then, verify against a running backend.
- To run the backend locally: in `lexly-backend`, `docker compose up -d`, then `./mvnw spring-boot:run "-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC"`. The dev SUPERADMIN is `superadmin@lexly.local` / `lexly-superadmin-dev` and must change its password on first login.
- No formatter is configured. Match the surrounding code (single quotes, semicolons and 2-space indent; only the Vite template files `main.tsx` and `vite.config.ts` omit semicolons).

## Source of truth / design docs

- `docs/Lexly-Frontend-Implementation-Plan.md`: phases F0–F8, target architecture, error-code catalogue (§3.6), security rules (§9) and working agreement (§10). Read it before starting a task.
- `docs/Lexly-UI-Spec.md`: layout, data, states and copy per screen. Each phase's spec is written before that phase starts (F0 and F1 are written).
- `docs/Lexly-API-Contract.md`: a **copy** of the backend's `docs/Lexly-API-Contract_backend.md`, which is the master. Re-copy it when it changes; don't edit it here first.
- `docs/Lexly-Frontend-Status-Report.md`: what is built against the plan.
- `docs/progress/frontend_progress.md`: every task gets an entry (date, status, what changed, how it was verified against the live backend, notes). At session start, read it and continue from In Progress / Blocked.
- The design (TDD v2) was frozen on 2026-10-12 in the backend repo (`docs/Lexly-TDD.md`, `docs/Lexly-Implementation-Plan.md`). Don't reopen settled decisions. Open decisions D1–D9 are in plan §7; ask the user before deciding one.
- Frontend phase F*n* mirrors backend Phase *n*. It starts once that phase's contract is agreed and is Done only after the backend phase is merged and the task has been exercised against the live backend.
- **Current state (2026-10-13):** backend Phases 0 and 1 are done (five roles, colleges, both login modes, `POST /auth/change-password`, the `PASSWORD_CHANGE_REQUIRED` gate, audit log). The frontend has not caught up: it still knows only the legacy roles `STUDENT` / `LAWYER` / `ADMIN`, `RequireAdmin` checks `role === 'ADMIN'`, login is email-only, and the role is decoded from the JWT (`roleFromAccessToken`). F0 and F1 address this. Some contract sections still say PROPOSED for Phase 1 endpoints that are now live.

## Architecture

`@/` maps to `src/` (in both `vite.config.ts` and `tsconfig.app.json`).

- `src/api/`: one module per backend area (`auth`, `users`, `content`, `caselaws`, `search`, `adminCaseLaws`). Each defines the UI model types and `to<Model>()` mappers that normalise DTOs (blank → `null`, missing list → `[]`), so components never see raw backend quirks. Keep the backend's list order (`display_order`); don't re-sort.
- `src/api/client.ts`: `apiClient.get/post/put/delete`, the only way to call the backend.
  - Attaches `Authorization: Bearer` from the session store, and sets JSON `Content-Type` when there is a body.
  - Non-2xx responses become `ApiError { code, message, status }` from the backend's `{ error, message }` body. A failed fetch becomes `NETWORK_ERROR`. **Branch on `code`, never on `message` or HTTP status.**
  - On a 401 it refreshes silently once and retries. All refreshes share one in-flight promise per tab and a Web Lock (`lexly-auth-refresh`) across tabs, because each refresh rotates the cookie and a parallel one would fail.
  - Cache modes for GETs: `no-cache` in dev (backend edits show at once; a cheap 304 via ETag); `reload` for 5 minutes after a logout or an expired session (a timestamp in `localStorage`), so the next user never sees the previous user's cached responses.
  - `skipAuthHandling` + `credentials: 'include'` are used only by the auth endpoints. The refresh cookie is scoped to `/api/v1/auth`.
- `src/auth/`:
  - `session-store.ts` holds the session in module memory. It is not React state and not Web Storage, so `client.ts` can use it outside React.
  - `AuthContext` mirrors the store via `useSyncExternalStore`. The status starts as `loading`, then `bootstrapSession()` calls `/auth/refresh` + `GET /users/me`, and `SessionPending` shows meanwhile.
  - Guards: `RequireAuth`, `RedirectIfAuthenticated` (signed-in users → `/dashboard`) and `RequireAdmin`. UI role checks are only a convenience; the server enforces access.
- Routing: `main.tsx` uses a data router (`createBrowserRouter` with one `*` route rendering `App`) so `useBlocker` works. The actual routes live in `App.tsx` `<Routes>`. Authenticated pages render inside `AppLayout`, which has a header, a bottom tab bar below 768 px, and a wide 72 rem layout for `/sections/*`, `/caselaws/*` and `/admin/*`.
- Data fetching: `hooks/useApiQuery(key, fetcher)` runs the fetch when `key` changes (`null` means don't fetch), exposes `idle/loading(staleData)/success/error` + `retry`, and drops superseded responses. `fetcher` must be fully determined by `key`. TanStack Query is the recommended addition from F2 (D1). Don't add it earlier without asking.
- `config/features.ts`: `VITE_API_*` flags gate Home cards for endpoints that aren't in TDD v2. Keep them `false` (D3). `VITE_HOME_MOCKS` (dev only) renders sample Home states from `dev/homeMocks.ts`.
- Pages are under `src/pages/<area>/`: `auth`, `content` (Library: acts, sections, case laws, search, study panel), `home`, `admin` (case-law admin and its reusable form parts). The plan's target is one folder and one lazily loaded route chunk per role area, with `roles.ts` + `RequireRole` replacing `RequireAdmin` (plan §3.1–3.2).

## Conventions

- **Styling:** CSS Modules only. Colocate `<Name>.module.css` next to the component, or use a shared one such as `AuthForm.module.css`. Use the `--lx-*` design tokens in `src/index.css`. Pair status colours with a text label.
- **URL state:** filters, query and page live in the URL. The page is 1-based in the URL and 0-based on the wire. Router state is only an optional "back to results" hint.
- **States:** every card and list has loading, empty and error states (`components/QueryStates`). One failing card never blanks a page.
- **Errors in the UI:** map backend codes and messages to friendly text (`pages/auth/authForm.ts`, `pages/admin/contentForm.ts`). Never show raw bodies or stack traces. Map server `VALIDATION_ERROR` paths to inline field and row errors plus an error summary. Client-side limits mirror the server's `@Size` constraints.
- **Forms:** no form library. Build on `Field`, `contentForm.ts`, `RepeatableList` and `useUnsavedChangesGuard` (`useBlocker` + `beforeunload`).
- **Accessibility:** one `<h1>` per screen, landmarks, `aria-live` for async results, `aria-busy` while refetching, everything keyboard-operable, and colour never the only signal.
- **TypeScript:** `verbatimModuleSyntax` is on, so use `import type` / inline `type` imports for types. `erasableSyntaxOnly` is on, so don't use enums, namespaces or parameter properties; use string-literal unions. `noUnusedLocals` / `noUnusedParameters` are on.
- **Comments:** JSDoc on exported types and non-obvious functions, explaining the *why* (see `client.ts`, `session-store.ts`).

## Security rules (plan §9)

- The access token stays in memory only, and the refresh token only in the `HttpOnly` cookie. No auth data in `localStorage` or `sessionStorage`.
- Render all backend text as plain text. Never use `dangerouslySetInnerHTML`, including for AI output. The only markup handling is `HighlightedSnippet` (`<b>` → `<mark>`) and the study panel's `RichText`, both built from text nodes.
- Student answers, feedback and marks are personal data. Keep them out of URLs, logs and analytics. URLs carry ids, never names or roll numbers.
- A 404 for another college's or professor's resource is shown as Not Found, never as "no access".
- Ask the user before adding a new dependency, third-party script or network origin.

## Git

- Conventional Commits (`feat(student): per-question answer upload`), one commit per task or small group of tasks.
- One branch per phase, cut from an up-to-date `master` (this repo's default branch). Never commit directly to `master`.
