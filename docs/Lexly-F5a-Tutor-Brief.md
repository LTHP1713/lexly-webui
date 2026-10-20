# F5a — AI legal tutor: frontend brief

Written 2026-10-20 from the backend repo (`C:\LIS\Lexly`) after backend Phase 5a was built. This brief tells this repo what changed upstream, which docs to update, and what to build. Once its content is in the plan, the UI spec and the progress file, delete it.

## 1. What changed upstream

- **Roadmap change (2026-10-19, decided by the user; don't reopen it):** Phase 5 (AI grading) is **on hold**, and assessments stay manually graded (F4). **Phase 5a, a RAG AI legal tutor**, is built instead. Phase 6 is split into **6a** (manual statistics, the old F6) and **6b** (AI analysis of those statistics plus a chatbot for C_ADMINs, planned later).
- **Backend Phase 5a** is committed on `lexly-backend` `feature/phase5a` (`a4f2bee`) and is **not merged yet**. It adds the `tutor` module, migration V21, and contract §11a.
- **`lexly-ai-service`** (`C:\Users\ashwa\lexly-ai-service`, Python/FastAPI with pgvector and Gemini) has its Phase 5a work merged to `main`. The browser **never** calls it. Only the backend does, with an API key.

```
lexly-webui ──JWT──> lexly-backend (/api/v1/tutor/**) ──x-api-key──> lexly-ai-service ──> Gemini
```

The settled product decisions, for reference (TDD §10a):
- Every role may use the tutor: SUPERADMIN, C_ADMIN, C_PROFESSOR, C_STUDENT and S_STUDENT. It's free for now; S_STUDENTs will need a paid plan later (Deferred B12, not this phase).
- Chat is multi-turn. The whole answer arrives at once, with **no streaming**.
- Each user gets **10 questions a day**, reset at **midnight India time**. A "not found" answer still counts. A failed call is refunded.
- A conversation is **deleted 24 h after its last message**. Chats are private; even SUPERADMIN can't read other users' chats.
- Answers cite their sources with `[n]` markers:
  - Library citations (`SECTION`, `CASE_LAW`) link to `/sections/:id` and `/caselaws/:id`.
  - Citations to documents in the PDF folder (`FILE`) show the file name and location, with no link.
- SUPERADMIN gets a **Re-index** button and a **daily AI spend graph**, filterable by college and role.

## 2. Docs to update in this repo first

1. **Re-copy the contract.** Copy `C:\LIS\Lexly\docs\Lexly-API-Contract_backend.md` over `docs/Lexly-API-Contract.md` without editing it. The copy here is behind the master: it lacks §11a and the new error codes in §0.8.
2. **`docs/Lexly-Frontend-Implementation-Plan.md`:**
   - Phase table: mark F5 "AI evaluation UI" as *on hold (backend Phase 5 on hold 2026-10-19)*. Add **F5a — AI legal tutor** (backend dep: Phase 5a, size M). Rename F6 to **F6a — Rankings & statistics** and add **F6b — AI analysis & admin chatbot** (to be planned).
   - Add an F5a section built from §4 below.
   - §3.6 error catalogue: add the three codes from §3 below. `QUOTA_EXCEEDED` now also has a tutor meaning.
3. **`docs/Lexly-UI-Spec.md`:** write the **F5a** section (layout, data, states and copy for each screen in §4) **before building**, as for every earlier phase. Add the new codes to §0.6.
4. **`docs/progress/frontend_progress.md`:** add the F5a entries as you go.
5. **`CLAUDE.md`:**
   - "Current state": F4 status, F5a in progress against backend `feature/phase5a`, and how to run the AI service.
   - Architecture: the new `src/api/tutor.ts` and `pages/tutor` / `pages/admin/tutor`.

## 3. API summary (contract §11a is the authority)

All tutor responses are `Cache-Control: no-store`.

| Call | Roles | Notes |
|---|---|---|
| `POST /tutor/messages` `{ conversationId \| null, question }` | all | `200 { conversation, question, answer, quota }`. **Can take up to ~60 s.** `question`: required, not blank, ≤ 2,000 chars |
| `GET /tutor/quota` | all | `{ limit, used, remaining, resetsAt }`. `resetsAt` = the next midnight in Asia/Kolkata, as a UTC instant |
| `GET /tutor/conversations` | all | Plain array (not paged), newest `lastMessageAt` first, live conversations only |
| `GET /tutor/conversations/{id}` | all | The conversation plus `messages`, oldest first |
| `DELETE /tutor/conversations/{id}` | all | `204` |
| `POST /superadmin/tutor/index-runs` | SUPERADMIN | No body. `202 TutorIndexRun`, or `409 INDEX_RUN_IN_PROGRESS` |
| `GET /superadmin/tutor/index-runs` | SUPERADMIN | The last 10 runs, newest first, `[]` if none. Poll every 5 s while the first one is `RUNNING` |
| `GET /superadmin/ai-usage/daily?from=&to=&collegeId=&role=` | SUPERADMIN | Zero-filled `days[]` (oldest first) plus `totals`, `rates` and `currency` (USD). Dates are `yyyy-MM-dd` India dates. The default range is the last 30 days; over 366 days or `to < from` returns `400` |

Shapes, as in the contract:
- `TutorMessage { id, role: USER|ASSISTANT, content, notFound, citations[], createdAt }`
- `TutorCitation { ref, sourceType: SECTION|CASE_LAW|FILE, sourceId|null, label, location|null, snippet }`
- `TutorConversation { id, title, createdAt, lastMessageAt, expiresAt }`

New error codes for `src/api/errors.ts`:

| Code | Status | UI behaviour |
|---|---|---|
| `QUOTA_EXCEEDED` | 429 | Disable the composer and refetch `/tutor/quota`. Banner: "You've used today's 10 questions. They reset at midnight India time ({local time of resetsAt})." Keep the typed question |
| `AI_UNAVAILABLE` | 503 | Inline on the pending message: "The tutor couldn't answer just now. Your question wasn't counted." Offer **Try again** and keep the question text. The rest of the app is unaffected |
| `INDEX_RUN_IN_PROGRESS` | 409 | Refetch the runs list and show the running run. It isn't an error toast |

A `404` from `POST /tutor/messages` with a `conversationId` means the conversation expired or was deleted. Show "This conversation has expired", start a new conversation, and keep the question in the composer.

## 4. What to build

Branch: `feature/f5a-tutor` already exists and is clean (cut from `master` after F4).

### F5a.1 API module: `src/api/tutor.ts`

- UI model types and `to<Model>()` mappers following the existing pattern (blank → `null`, missing list → `[]`).
- Keep the backend's order: conversations newest first, messages oldest first.
- Add `queryKeys.tutor.*` (quota, conversations, conversation(id), indexRuns, usage(filters)) in `lib/queryClient.ts`.
- Add MSW handlers for every endpoint.
- **No client-side timeout shorter than ~70 s on the ask call.** The backend waits up to 60 s.

### F5a.2 Route and nav: `/tutor` and `/tutor/:conversationId`

- **Open to every role.** Don't add it to `AREAS` in `auth/roles.ts`; like the Library, it's a shared route. Add `/tutor` to `isWidePath`.
- Lazily load `pages/tutor/`.
- Add a **Tutor** nav item (new chat-bubble icon in `components/icons/Icons`) for every role. It brings SUPERADMIN, C_ADMIN and S_STUDENT to the 5-item limit.
- For SUPERADMIN, the item's `matches` also covers `/admin/tutor`.
- The URL holds only the conversation id. **Never put question text in a URL.**

### F5a.3 Tutor screen

Two-pane layout on wide screens: the conversation list on the left, the thread on the right. On narrow screens, show the list or the thread, with a back button.

- **Quota line**, always visible near the composer: "7 of 10 questions left today · resets at {local time}". Update it from the `quota` in each `POST` response; don't refetch for this.
- **Conversation list:** the title (one line, already cut to 120 chars by the server) and a relative "deletes in 23 h" taken from `expiresAt`. Add a **New chat** button and **Delete** with a `ConfirmDialog` ("This chat will be deleted now. Chats are deleted automatically 24 h after the last message anyway."). Empty state: a short explainer and 2–3 example questions as buttons that fill the composer.
- **Thread:** `USER` and `ASSISTANT` messages oldest first.
  - When the user sends:
    - Show the question at once as a pending message, with an "Answering… this can take up to a minute" status in an `aria-live` region.
    - Disable Send while the request runs, and allow only one question in flight.
  - On success: replace the pending message with the server's `question` and `answer`, navigate to `/tutor/{conversation.id}` (replace, not push) for a new chat, and invalidate the conversation list.
  - On `AI_UNAVAILABLE` or `NETWORK_ERROR`: mark the pending message as failed, with **Try again**. Nothing was stored server-side.
- **Composer:** a textarea with a 2,000-character counter (mirrors the `@Size`) and blank-check. Enter sends and Shift+Enter adds a new line. Keep the draft if sending fails.
- **Answer rendering:**
  - The content is **plain text**: build it from text nodes and **never** use `dangerouslySetInnerHTML`. Split it into paragraphs on blank lines.
  - Turn each `[n]` marker whose `n` matches a `citations[].ref` into a small superscript button that scrolls to and highlights that source. Leave unknown markers as text.
- **Sources list** under each answer, numbered by `ref`:
  - `SECTION` and `CASE_LAW`: the `label` is a `<Link>` to `/sections/{sourceId}` or `/caselaws/{sourceId}`. A source deleted since the last re-index shows the page's normal Not Found; nothing special is needed.
  - `FILE`: `label · location` (e.g. `Contract notes.pdf · page 4`) with **no link**.
  - Show the `snippet` (≤ 300 chars) as a quote, collapsed by default on mobile.
- **Not-found answers** (`notFound: true`): render the fixed sentence in a muted note style, with no sources and the hint "Try naming the act or section." Remind the user it still used a question.
- **Disclaimer** under the thread, short: "Answers come only from Lexly's library and study material and may be incomplete. Check the cited sources."
- A `404` on opening `/tutor/:id` shows "This conversation has expired or was deleted" with **New chat**. That's not a generic Not Found page.

### F5a.4 SUPERADMIN tutor admin: `/admin/tutor`

Link to it from the `/admin` hub (a card) and from the `/tutor` header for SUPERADMIN only. Use two tabs held in the URL (`?tab=index|spend`).

- **Index tab:**
  - A **Re-index** button with a `ConfirmDialog` explaining that it re-reads the PDF folder and the whole library in the background and can take several minutes. While the latest run is `RUNNING`, disable the button.
  - Latest run card: the status badge (with a text label), started by / at, duration, files ingested and failed (failed file names listed), library sections and case laws, chunks embedded / reused / removed, embedding tokens, and `error` for `FAILED`.
  - Poll `GET …/index-runs` every 5 s **only while the first run is `RUNNING`**, and stop when it finishes or the page unmounts.
  - Below the card, a table of the previous runs. `startedBy: null` is shown as "Removed user".
- **Spend tab:**
  - Filters in the URL: from and to (date inputs; default the last 30 days), college (from the colleges list) and role (the five roles). Validate `to ≥ from` and a range of ≤ 366 days on the client too.
  - Stat tiles from `totals`: cost (USD, 2–4 decimals), questions, index runs, and input, output and embedding tokens.
  - A **daily cost bar chart in plain SVG**, drawn by hand as F6.3 plans. **Don't add a chart library without asking the user.**
    - Add a hover/focus tooltip with the date, cost and questions.
    - Add a visually hidden data table (or a "Show as table" toggle) with the same rows, for accessibility.
  - Footnotes: the current `rates` ("$1.125 / $5.625 / $0.20 per million input / output / embedding tokens; past days keep the rate of their time"). When a college or role filter is set: "Index runs aren't tied to a college or role, so they're excluded."

### F5a.5 Error catalogue and copy

Add the three codes from §3 to `errors.ts` and its test. Confirm each status against the live backend and record it in the progress file.

### F5a.6 Tests

- **Unit:**
  - Mappers.
  - The `[n]` marker parser: known, unknown, adjacent `[1][2]`, and markers inside words.
  - The quota and expiry formatting around India midnight, using the user's local timezone.
- **Component/route (MSW):**
  - Ask happy path: a new chat navigates to `/tutor/:id`.
  - `QUOTA_EXCEEDED` disables the composer and keeps the text.
  - `AI_UNAVAILABLE` shows Try again, which resends.
  - A `404` on an expired conversation.
  - A not-found answer.
  - Library citations are links and `FILE` citations aren't.
  - Delete a conversation.
  - Re-index `409` and polling start and stop.
  - Spend filters go into the URL, and the range validation.
  - The non-SUPERADMIN can't see the admin link or route.
- **E2E (`e2e/f5a-tutor.spec.ts`):**
  - Needs the backend on `feature/phase5a` **and** `lexly-ai-service` running with a Gemini key.
  - Golden path: SUPERADMIN re-indexes and waits for `SUCCEEDED`, then a C_STUDENT asks a question, sees a cited answer, opens a section link and asks a follow-up in the same chat.
  - Skip with a clear message when the AI service isn't reachable.
  - Asking uses real quota, so create fresh users with `e2e/api.ts`.

## 5. Running the stack locally

1. AI service: in `C:\Users\ashwa\lexly-ai-service`, set `.env` (Gemini key, `SERVICE_API_KEY`) and run `docker compose up -d`. It listens on `http://localhost:8000`.
2. Backend: in `C:\LIS\Lexly`, check out `feature/phase5a`. Set `LEXLY_AI_SERVICE_URL=http://localhost:8000` and `LEXLY_AI_SERVICE_API_KEY` to the same value as the service's `SERVICE_API_KEY`. Then run `docker compose up -d` and `./mvnw spring-boot:run "-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC"`.
3. As SUPERADMIN, open `/admin/tutor` and **Re-index** once. The tutor answers "not found" to everything until the library is indexed.
4. Without the AI service, every ask returns `503 AI_UNAVAILABLE`. That's useful for checking the failure UI. Quota, conversations and spend still work.

## 6. Out of scope for F5a

- Streaming answers.
- Uploading documents to the tutor (users can't; the PDF folder is owner-managed).
- Editing the cost rates in the UI (they're backend configuration).
- Paid plans for S_STUDENTs.
- Phase 5 AI grading UI (the old F5).
- Phase 6b admin chatbot.
- Any change to the Library pages beyond being link targets.

**Done when:**
- In the browser, a user of each role asks a question and sees a cited answer whose library links open the right section or case law.
- An 11th question that day shows the quota banner.
- Stopping the AI service shows the unavailable state without using up a question.
- SUPERADMIN re-indexes and watches the run finish.
- The spend graph shows that day's questions and cost.
- All of this works against the backend once `feature/phase5a` is merged.
