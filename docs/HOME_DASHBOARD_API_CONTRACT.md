# Home Dashboard — Backend API Contract

Target audience: whoever implements these endpoints in `lexly-backend` (Spring Boot 3, Java 17,
PostgreSQL + Flyway). Every endpoint here is **missing today**; the web frontend is already built
against these exact shapes (see [§0.6 Frontend wiring](#06-frontend-wiring)), so implementing them
as written means flipping a flag in the frontend's `.env` — no component changes.

> **Free/Pro is suspended (2026-10-11).** The backend removed the free/Pro model, and the
> frontend no longer reads `isFree` or handles `PRO_REQUIRED`: no Pro badges, lock icons or
> locked teasers. Everything below about `isFree`, Pro checks, `EntitlementService`,
> `PRO_REQUIRED` and locked content is **out of scope until Pro returns**. Omit `isFree` from
> these responses and skip the Pro checks; if they are sent, the frontend ignores them.

Status of each Home feature right now:

| Home feature | Frontend | Current data source | Target API | Status |
|---|---|---|---|---|
| Greeting name | Complete | none (greeting has no name) | `GET /users/me` | AWAITING BACKEND |
| Universal Search | Complete | fan-out: `/sections/search` + `/caselaws?q=` + `/acts` | `GET /search` | ADAPTER |
| Quick action: Bare Acts | Complete | `GET /acts` … | existing | CONNECTED |
| Quick action: Case Laws | Complete (new `/caselaws` pages) | `GET /caselaws`, `GET /caselaws/{id}` | existing | CONNECTED |
| Quick action: Practice | Placeholder page | none | §H–§K | AWAITING BACKEND (UI deferred) |
| Practice Progress | Complete | none | `GET /users/me/practice-stats` | AWAITING BACKEND |
| Bare Acts Progress | Complete | none | `GET /users/me/bare-act-progress` | AWAITING BACKEND |
| Continue Learning | Complete | none | `GET /users/me/continue-learning` | AWAITING BACKEND |
| Activity tracking | Complete (fires on section/case open) | none | `POST /users/me/learning-activity` | AWAITING BACKEND |

**Recommended build order:** §G + §D + §F (one set of tables, one frontend flag) → §A → §C → §B →
§H–§K.

---

## 0. Conventions (apply to every endpoint)

### 0.1 Base path, auth and identity

- Base path `/api/v1`. All endpoints below require `Authorization: Bearer <accessToken>`; none
  are added to `SecurityConfig`'s `permitAll()` list.
- The user is **always** the JWT principal (`@AuthenticationPrincipal UUID userId`, as set by the
  existing `JwtAuthenticationFilter`). No endpoint accepts a `userId` in the path, query or body.
  `/users/me/**` is the only user-scoped prefix.
- Ownership failures return **404**, not 403 (same rule as the existing `practice` endpoints), so
  existence of another user's data is never leaked.

### 0.2 Identifiers and types

- **All ids are UUID strings**, matching every existing entity (`acts`, `sections`, `case_laws`,
  `questions`, …). The numeric ids in the original brief (`"id": 42`) are replaced by UUIDs here.
- Timestamps: UTC ISO-8601 with `Z`, from `java.time.Instant` (e.g. `"2026-10-05T18:42:31Z"`).
  Configure `spring.jackson.serialization.write-dates-as-timestamps=false`.
- Dates without time (e.g. `decidedOn`): `yyyy-MM-dd` (`LocalDate`).
- Numeric statistics are **never `null`** — they are `0` when there is no data.
- Percentages are numbers in `0–100` (not `0–1`), rounded as stated per field.
- Enums are serialized as their `UPPER_SNAKE` names.

### 0.3 Error format

Keep the existing `common.dto.ErrorResponse` shape — the frontend's `ApiError` reads the `error`
key, so **do not rename it to `code`**. Additively include a timestamp:

```json
{
  "error": "NOT_FOUND",
  "message": "No section found with id 5c0e…",
  "timestamp": "2026-10-05T18:42:31Z"
}
```

| Status | `error` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bean-validation or business-rule validation failed. `message` keeps the existing comma-joined `"field: reason"` format. |
| 401 | `UNAUTHORIZED` | Missing/expired/invalid access token (frontend then silently refreshes once). |
| 403 | `PRO_REQUIRED` | The action needs Pro (standard shape here — none of these endpoints return the flattened teaser). |
| 403 | `FORBIDDEN` | Role not allowed (not used by these endpoints). |
| 404 | `NOT_FOUND` | Unknown id, or a resource owned by another user. |
| 429 | `RATE_LIMITED` | Existing `common.ratelimit.RateLimiter` rejected the call (search only). Add this code to `ErrorCodes` if not present. |
| 500 | `INTERNAL_ERROR` | Unhandled. Never include stack traces. |

### 0.4 Pagination and sorting

Reuse `common.dto.PagedResponse<T>`:

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }
```

`page` is 0-based (default 0, min 0); `size` default 20, min 1, max 50 unless stated. Out-of-range
values → 400 `VALIDATION_ERROR` (do not silently clamp). Sorting uses `sort=<field>,<asc|desc>`
with a whitelist per endpoint; an unknown field → 400.

### 0.5 Web routes (for `navigationPath` fields)

The web frontend builds links from `type` + `id` itself (the same API will serve the React Native
app, which has no URL paths). `navigationPath` is therefore **optional and informational**; when
returned it must match these routes:

| Type | Web route |
|---|---|
| `ACT` | `/acts/{actId}` |
| `SECTION` | `/sections/{sectionId}` |
| `CASE_LAW` | `/caselaws/{caseLawId}` |
| `TOPIC` / `QUESTION` | none yet → `null` |

### 0.6 Frontend wiring

Each endpoint is called through one service function and gated by an env flag (default `false`).
While a flag is off the frontend makes no request and shows a "not tracked yet" state.

| Endpoint | Frontend flag | Service (`src/api/…`) | Hook / consumer |
|---|---|---|---|
| `GET /users/me` | `VITE_API_USERS_ME` | `users.ts → getCurrentUser` | `useCurrentUser` → greeting |
| `GET /search` | `VITE_API_UNIFIED_SEARCH` | `search.ts → universalSearch` | `UniversalSearch` |
| `GET /users/me/practice-stats` | `VITE_API_PRACTICE_STATS` | `users.ts → getPracticeSummary` | `usePracticeStats` |
| `GET /users/me/bare-act-progress` | `VITE_API_LEARNING_PROGRESS` | `users.ts → getBareActProgress` | `useBareActProgress` |
| `GET /users/me/continue-learning` | `VITE_API_LEARNING_PROGRESS` | `users.ts → getContinueLearning` | `useContinueLearning` |
| `POST /users/me/learning-activity` | `VITE_API_LEARNING_PROGRESS` | `users.ts → recordLearningActivity` | `useRecordLearningActivity` (section + case detail pages) |
| `PUT /users/me/sections/{id}/progress` | — | `users.ts → setSectionProgress` | not used by any screen yet |

Suggested Spring layout: a new `com.lexly.progress` module (`UserMeController`,
`LearningProgressController`, `PracticeStatsService`, …) and a `com.lexly.search` module. DTOs as
Java `record`s.

---

## A. Current user

```http
GET /api/v1/users/me
```

**Purpose:** the signed-in student's basic profile; the Home greeting needs `firstName`.
**Auth:** required. **Params / body:** none.

**200 OK**

```json
{
  "id": "7b1e4c0a-2f4d-4f7e-9a51-0c3a1f6d2b11",
  "email": "student@example.com",
  "firstName": "Aishwary",
  "fullName": "Aishwary Gupta",
  "role": "STUDENT",
  "createdAt": "2026-09-23T10:15:00Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | The JWT `sub`. |
| `email` | string | |
| `firstName` | string \| null | See rule below. `null` only if `fullName` is blank. |
| `fullName` | string \| null | As entered at registration (`users.full_name`). |
| `role` | `STUDENT` \| `LAWYER` \| `ADMIN` | |
| `createdAt` | Instant | Account creation. |

**Business rules**

- No schema change is needed: `firstName` = first whitespace-separated token of
  `trim(full_name)`, e.g. `"Aishwary Gupta"` → `"Aishwary"`, `"  Priya  "` → `"Priya"`.
- If `firstName` should later be user-editable (preferred name, honorifics such as "Dr."), add a
  nullable `users.preferred_name` and return it as `firstName` when set; the contract stays the same.
- Never derive a name from the email.

**Errors:** 401 (no/invalid token). If the token's user no longer exists → 401 `UNAUTHORIZED`
(treat as a dead session, not 404).

---

## B. Universal search

```http
GET /api/v1/search?q=article%2014&types=ACT,SECTION,CASE_LAW,TOPIC,QUESTION&limit=5
```

**Purpose:** one query across all learning content, grouped by type, for the Home search box.
Replaces the frontend's current three-request fan-out. **Auth:** required.

**Query parameters**

| Param | Required | Default | Rules |
|---|---|---|---|
| `q` | yes | — | Trimmed, internal whitespace collapsed. Length **2–100** after trimming, else 400. |
| `types` | no | all of `ACT,SECTION,CASE_LAW,TOPIC,QUESTION` | Comma-separated, case-insensitive, duplicates ignored. Unknown value → 400. Types with no backing table yet (`TOPIC`, `QUESTION` until §H exists) are **accepted** and simply return no group. |
| `limit` | no | 5 | Results **per group**, 1–10, else 400. |

**200 OK**

```json
{
  "query": "article 14",
  "groups": [
    {
      "type": "SECTION",
      "label": "Sections",
      "totalResults": 3,
      "results": [
        {
          "id": "0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40",
          "title": "Article 14 — Equality before law",
          "subtitle": "Constitution of India",
          "snippet": "The State shall not deny to any person <b>equality</b> before the law…",
          "isFree": true,
          "navigationPath": "/sections/0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40"
        }
      ]
    },
    {
      "type": "CASE_LAW",
      "label": "Case Laws",
      "totalResults": 4,
      "results": [
        {
          "id": "c4a1e2d9-7f3b-4c6a-9e2d-1b5f8a0c3e77",
          "title": "E.P. Royappa v. State of Tamil Nadu",
          "subtitle": "Landmark • (1974) 4 SCC 3 • Supreme Court of India",
          "snippet": null,
          "isFree": false,
          "navigationPath": "/caselaws/c4a1e2d9-7f3b-4c6a-9e2d-1b5f8a0c3e77"
        }
      ]
    }
  ],
  "totalResults": 7
}
```

| Field | Type | Notes |
|---|---|---|
| `query` | string | The normalized `q` actually searched. |
| `groups[]` | array | Only groups with ≥1 result. Ordered by the score of each group's best result (desc); ties broken by the fixed order `ACT, SECTION, CASE_LAW, TOPIC, QUESTION`. |
| `groups[].type` | enum | `ACT` \| `SECTION` \| `CASE_LAW` \| `TOPIC` \| `QUESTION`. |
| `groups[].label` | string | Display label: `Bare Acts`, `Sections`, `Case Laws`, `Topics`, `Questions`. |
| `groups[].totalResults` | int | Total matches for this type (can exceed `results.length`). |
| `results[].id` | UUID | Id of the act / section / case law / topic / question. |
| `results[].title` | string | ACT: act title. SECTION: `"{label} {number} — {title}"` (label = `Section`/`Article`, see §F note). CASE_LAW: case name. TOPIC: topic name. QUESTION: question text truncated to 140 chars. |
| `results[].subtitle` | string \| null | ACT: `shortCode`. SECTION: **parent act title**. CASE_LAW: `importance • citation • court` (omit nulls). TOPIC: subject name. QUESTION: `subject • topic`. |
| `results[].snippet` | string \| null | Matched excerpt, ≤ 200 chars. The only markup allowed is `<b>…</b>` around matched terms (the frontend renders only that tag). **`null` for locked items** (`isFree: false` and the user isn't Pro) — this also closes the existing `/sections/search` snippet-redaction gap. |
| `results[].isFree` | boolean | Locked items are still returned (the UI shows a Pro badge). Always `true` for ACT and TOPIC. |
| `results[].navigationPath` | string \| null | Optional, see §0.5. |
| `totalResults` | int | Sum of `groups[].totalResults`. |

**Ranking rules (per group, highest first)**

1. **Provision-number queries.** If `q` matches
   `^(?:section|sec\.?|s\.|article|art\.?)\s*(\d+[A-Z]{0,2})$` (case-insensitive), the SECTION
   whose `section_number` equals the captured number ranks first (if several acts have it, the act
   whose provision label matches the word used — "Article" → Constitution — first, then act
   title). A bare number (`^\d+[A-Z]{0,2}$`) gets the same treatment at lower weight.
2. **Exact title match**, case-insensitive (act title, `shortCode`, case name, topic name).
3. **Case names:** normalize both sides before comparing — lowercase, strip punctuation, treat
   `v`, `v.`, `vs`, `vs.`, `versus` as the same token. An exact `citation` match ranks like (2).
4. **Prefix match** on title / short code.
5. **Full-text rank** (`ts_rank_cd`) on the type's searchable text, then trigram similarity on the
   title as a fuzzy tiebreak (handles typos such as "kesavanada").
6. Final tiebreak: CASE_LAW `importance` (LANDMARK > IMPORTANT > STANDARD), then title A–Z.

**Empty result:** `200` with `"groups": []` and `"totalResults": 0`. Never 404.

**Errors**

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `q` missing, shorter than 2 or longer than 100; unknown `types` value; `limit` out of 1–10. |
| 401 | `UNAUTHORIZED` | |
| 429 | `RATE_LIMITED` | More than ~30 searches/min per user (the frontend debounces at 300 ms, so normal typing stays well under). |

**Implementation recommendation**

- PostgreSQL full-text + `pg_trgm`, no external search engine yet:
  - add a generated `search_vector tsvector` column to `sections` (`section_number`, `title`,
    `body_text` with weights A/A/C), `case_laws` (`title` A, `citation` A, `court` B, summary text
    C) and later `topics`/`questions`; GIN index on each;
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm;` plus a GIN trigram index on the title columns.
  - Use the `simple` text-search configuration (or `english` without stemming legal terms) so
    "section 10" and case names aren't mangled.
- Run one query per requested type **in parallel** (`CompletableFuture` on a bounded executor),
  each `LIMIT :limit` plus a `count(*) OVER ()` for `totalResults`; merge in the service.
- Build `snippet` with `ts_headline(…, 'StartSel=<b>, StopSel=</b>, MaxWords=30, MinWords=10')`, then
  escape everything except those tags.
- Resolve Pro once per request via the existing `EntitlementService` (Redis-cached) to decide
  snippet redaction.
- When the data outgrows Postgres FTS, the same contract can sit on OpenSearch.

---

## C. Practice progress

```http
GET /api/v1/users/me/practice-stats
```

**Purpose:** MCQ performance summary for the Home "Practice Progress" card. **Auth:** required.
**Params / body:** none (a `subjectId` filter can be added later without breaking the contract).

**200 OK**

```json
{
  "attempted": 245,
  "uniqueQuestionsAttempted": 190,
  "correct": 184,
  "wrong": 61,
  "accuracy": 75.1
}
```

| Field | Type | Definition |
|---|---|---|
| `attempted` | int ≥ 0 | Number of **answered question-attempts**: answered objective responses across all of the user's **submitted** attempts. Answering the same MCQ in three different attempts counts **3**. |
| `uniqueQuestionsAttempted` | int ≥ 0 | Distinct questions among those responses (the example above: 190). |
| `correct` | int ≥ 0 | Responses among `attempted` that were scored correct. |
| `wrong` | int ≥ 0 | `attempted − correct`. |
| `accuracy` | number | `correct / attempted × 100`, rounded **half-up to 1 decimal**. `0` when `attempted = 0`. |

**Business rules**

- Counted: responses that belong to attempts with status `EVALUATED` (submitted and scored),
  whose question is `OBJECTIVE`, and whose answer is non-blank. Not counted: `IN_PROGRESS`
  attempts, skipped/unanswered questions, `SUBJECTIVE` questions.
- Within one attempt a question has exactly one response (the existing save-response endpoint
  overwrites), so "attempt" is per question per attempt.
- "Correct" should come from a persisted `is_correct` flag written at scoring time (see data
  model §M). Until that column is backfilled, `score >= max_marks` is the equivalent rule for
  objective questions.
- Invariants the frontend relies on: `correct ≤ attempted`, `wrong = attempted − correct`,
  `uniqueQuestionsAttempted ≤ attempted`. The frontend recomputes `wrong` and the rounded
  percentage from the counts defensively, but the API must already satisfy them.

**Reference query** (adapt table names to the existing V1–V8 migrations):

```sql
SELECT count(*)                                AS attempted,
       count(DISTINCT r.question_id)           AS unique_questions_attempted,
       count(*) FILTER (WHERE r.is_correct)    AS correct
FROM   attempt_responses r
JOIN   test_attempts a ON a.id = r.attempt_id
JOIN   questions q     ON q.id = r.question_id
WHERE  a.user_id = :userId
  AND  a.status = 'EVALUATED'
  AND  q.correct_option IS NOT NULL          -- objective only
  AND  coalesce(trim(r.answer_text), '') <> '';
```

Index: `test_attempts (user_id, status)`.

**Empty response:** a user with no submitted attempts gets **200**:

```json
{ "attempted": 0, "uniqueQuestionsAttempted": 0, "correct": 0, "wrong": 0, "accuracy": 0 }
```

**Errors:** 401 only.

---

## D. Bare Acts progress

```http
GET /api/v1/users/me/bare-act-progress
```

**Purpose:** Act-wise reading completion for the Home "Bare Acts Progress" list. **Auth:** required.

**Query parameters**

| Param | Default | Rules |
|---|---|---|
| `includeUnstarted` | `false` | `true` also returns acts the user hasn't opened (0%), after the started ones. |

**200 OK**

```json
{
  "acts": [
    {
      "actId": "a3c1b8f2-5d6e-4a7b-8c9d-0e1f2a3b4c5d",
      "actName": "Constitution of India",
      "shortCode": "COI",
      "totalSections": 448,
      "completedSections": 322,
      "completionPercentage": 71.88,
      "lastSectionId": "0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40",
      "lastSectionNumber": "21",
      "lastSectionTitle": "Protection of life and personal liberty",
      "lastAccessedAt": "2026-10-05T18:42:31Z"
    },
    {
      "actId": "b9d2e7a1-3c4f-4b5a-9d8e-7f6a5b4c3d2e",
      "actName": "Indian Contract Act, 1872",
      "shortCode": "ICA",
      "totalSections": 238,
      "completedSections": 114,
      "completionPercentage": 47.9,
      "lastSectionId": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
      "lastSectionNumber": "31",
      "lastSectionTitle": "\"Contingent contract\" defined",
      "lastAccessedAt": "2026-10-04T09:12:00Z"
    }
  ]
}
```

| Field | Type | Definition |
|---|---|---|
| `actId`, `actName`, `shortCode` | | From `bare_acts`. |
| `totalSections` | int ≥ 0 | All sections of the act **including Pro-locked ones** (progress is through the whole Act). |
| `completedSections` | int ≥ 0 | Distinct sections of this act with `user_section_progress.completed = true` for this user. |
| `completionPercentage` | number | `completedSections / totalSections × 100`, rounded half-up to **2 decimals**; **`0` when `totalSections = 0`** (never divide by zero, never null). Capped at 100. |
| `lastSectionId`, `lastSectionNumber`, `lastSectionTitle` | nullable | The section of this act the user opened most recently (`max(last_opened_at)`); all `null` for unstarted acts. `lastSectionTitle` may be `null` when the section has no title. |
| `lastAccessedAt` | Instant \| null | That section's `last_opened_at`; `null` for unstarted acts. |

**Business rules — what "completed" means (MVP)**

- A section becomes **completed/read the first time the student opens its detail page with full
  access** (recorded by §G). Opening it again updates `last_opened_at` but never increases
  completion — one row per `(user, section)` (unique constraint).
- A Pro-locked section the student can't read is never marked complete (the 403 teaser view
  doesn't record activity).
- Deleted sections disappear from both numerator and denominator (FK `ON DELETE CASCADE`).
- If a student loses Pro, sections already completed stay completed.

**Sorting:** `lastAccessedAt` **desc** (most recently read act first), then `actName` A–Z.
Unstarted acts (only with `includeUnstarted=true`) come last, by `actName`.

**Pagination:** none — the number of acts is small (tens). If it exceeds ~200, add `page/size`
and the `PagedResponse` envelope under a new version.

**Empty response:** a user who has read nothing gets `200 { "acts": [] }`.

**Errors:** 401; 400 if `includeUnstarted` isn't a boolean.

**Reference query**

```sql
WITH totals AS (
  SELECT act_id, count(*) AS total FROM sections GROUP BY act_id
), mine AS (
  SELECT p.act_id,
         count(*) FILTER (WHERE p.completed) AS completed,
         max(p.last_opened_at)               AS last_opened_at
  FROM   user_section_progress p
  WHERE  p.user_id = :userId
  GROUP  BY p.act_id
)
SELECT a.id, a.title, a.short_code,
       coalesce(t.total, 0)     AS total_sections,
       coalesce(m.completed, 0) AS completed_sections,
       m.last_opened_at
FROM   bare_acts a
JOIN   mine m        ON m.act_id = a.id          -- LEFT JOIN when includeUnstarted=true
LEFT   JOIN totals t ON t.act_id = a.id
ORDER  BY m.last_opened_at DESC NULLS LAST, a.title;
```

The last section per act is a second query (`DISTINCT ON (act_id) … ORDER BY act_id,
last_opened_at DESC`) joined to `sections` for number/title.

---

## E. Mark a section as read / unread

```http
PUT /api/v1/users/me/sections/{sectionId}/progress
```

**Purpose:** explicit completion toggle (e.g. a future "Mark as read / unread" control).
Opening a section does **not** need this call — §G already marks it read.
**Auth:** required.

**Path:** `sectionId` — UUID of an existing section.

**Request body**

```json
{ "completed": true }
```

| Field | Rules |
|---|---|
| `completed` | Required boolean (`@NotNull`). |

**200 OK**

```json
{
  "sectionId": "0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40",
  "completed": true,
  "completedAt": "2026-10-05T18:42:31Z"
}
```

**Business rules — idempotent upsert on `(user_id, section_id)`**

- `completed: true`: create the row if absent (`first_opened_at = last_opened_at = now`), set
  `completed = true`, and set `completed_at = coalesce(completed_at, now())` — repeated calls keep
  the **original** `completedAt` and never create duplicates.
- `completed: false`: set `completed = false`, `completed_at = null`; keep the row (its
  `first_opened_at` / `last_opened_at` history still feeds §D/§F). No row → 200 with
  `completed: false, completedAt: null` (nothing created).
- Implement with `INSERT … ON CONFLICT (user_id, section_id) DO UPDATE` so concurrent calls are
  safe.

**Errors**

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/non-boolean `completed`; malformed UUID. |
| 401 | `UNAUTHORIZED` | |
| 403 | `PRO_REQUIRED` | `completed: true` on a locked section for a non-Pro user. |
| 404 | `NOT_FOUND` | Section doesn't exist. |

---

## F. Continue learning

```http
GET /api/v1/users/me/continue-learning
```

**Purpose:** the single most relevant item to resume, shown in the Home "Continue Learning" card.
**Auth:** required. **Params / body:** none.

**200 OK**

```json
{
  "type": "SECTION",
  "id": "0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40",
  "subject": "Constitution of India",
  "title": "Article 14",
  "subtitle": "Equality before law",
  "progressPercentage": 71.88,
  "navigationPath": "/sections/0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40",
  "lastAccessedAt": "2026-10-05T18:42:31Z"
}
```

| Field | Type | Definition |
|---|---|---|
| `type` | `SECTION` \| `CASE_LAW` \| `TOPIC` | `TOPIC` is reserved until §H's topics exist. |
| `id` | UUID | Id of that content. |
| `subject` | string \| null | Small heading above the title. Today: SECTION → parent act title; CASE_LAW → `"Case Law"`; once subjects exist → the subject name (e.g. "Constitutional Law"). |
| `title` | string | SECTION: `"{provisionLabel} {sectionNumber}"` (e.g. `Section 10`, `Article 14`); CASE_LAW: case name; TOPIC: topic name. |
| `subtitle` | string \| null | SECTION: section title; CASE_LAW: `citation`; TOPIC: subject name. |
| `progressPercentage` | number \| null | SECTION → the parent act's `completionPercentage` (§D); TOPIC → topic completion; CASE_LAW → `null` (a single case has no meaningful progress). The frontend hides the bar when `null`. |
| `navigationPath` | string \| null | Optional, see §0.5. |
| `lastAccessedAt` | Instant | When the student last opened it. |

**Business rules**

- MVP: the user's row in `user_learning_activity` with the greatest `last_accessed_at`, whose
  content still exists (skip rows whose content was deleted).
- Content that has since become locked is still returned; opening it shows the existing Pro
  teaser.
- *Provision label:* sections only store `section_number`, but the Constitution uses "Article".
  Add a nullable `bare_acts.provision_label` (default `'Section'`) and use it here and in §B.

**Empty response:** **`204 No Content`** when the user has no recorded activity. (The frontend
maps 204 to its "Nothing to continue yet" state.)

**Errors:** 401 only.

---

## G. Record learning activity

```http
POST /api/v1/users/me/learning-activity
```

**Purpose:** tells the backend the student opened a piece of content. This single call feeds
**Continue Learning (§F)** and, for sections, **Bare Acts Progress (§D)**. **Auth:** required.

**Request body**

```json
{ "contentType": "SECTION", "contentId": "0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40" }
```

| Field | Rules |
|---|---|
| `contentType` | Required. `SECTION` \| `CASE_LAW` (later `TOPIC`). Unknown → 400. |
| `contentId` | Required UUID of existing content of that type. |

**Response:** `204 No Content`.

**Business rules (one transaction)**

1. Verify the content exists (else 404) and that the user can read it in full: free, or user is
   Pro (via `EntitlementService`). Locked → 403 `PRO_REQUIRED` and **nothing is recorded**.
2. Upsert `user_learning_activity` on `(user_id, content_type, content_id)`:
   `last_accessed_at = now()`, `access_count = access_count + 1`
   (`first_accessed_at` set on insert).
3. If `SECTION`: upsert `user_section_progress` on `(user_id, section_id)`:
   `last_opened_at = now()`, `open_count + 1`, `completed = true`,
   `completed_at = coalesce(completed_at, now())`, `first_opened_at` on insert, `act_id` copied
   from the section.

Calling it repeatedly is safe: it never creates duplicate rows and never increases completion
twice. The web frontend calls it once per detail-page view (in development React StrictMode may
send it twice — harmless by design).

**Errors**

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/unknown `contentType`, missing/malformed `contentId`. |
| 401 | `UNAUTHORIZED` | |
| 403 | `PRO_REQUIRED` | Content is locked for this user. |
| 404 | `NOT_FOUND` | No such content. |

**Why an explicit POST rather than recording inside `GET /sections/{id}`:** GETs must stay safe and
cacheable (prefetching, retries and admin previews would otherwise count as "reading"), and the
same tracking then works for case laws and future topics without touching each read endpoint.
Section completion is a side effect of this call, so the client makes one request, not two.

---

## H. Practice questions

Prerequisite lookups for subject/topic filters (also the base for the future "Subjects" nav):

```http
GET /api/v1/subjects
GET /api/v1/subjects/{subjectId}/topics
```

`200` arrays, sorted by `displayOrder` then `name`, unpaginated:

```json
[{ "id": "5e…", "name": "Constitutional Law", "slug": "constitutional-law", "displayOrder": 1, "topicCount": 12, "questionCount": 340 }]
```

```json
[{ "id": "9a…", "subjectId": "5e…", "name": "Fundamental Rights", "slug": "fundamental-rights", "displayOrder": 1, "questionCount": 85 }]
```

`404 NOT_FOUND` for an unknown `subjectId`. Empty → `200 []`.

```http
GET /api/v1/practice/questions?subjectId=&topicId=&difficulty=&examType=&questionBankId=&page=0&size=20&sort=createdAt,desc
```

(Placed under `/practice` to stay in the existing practice module rather than a top-level
`/questions`.)

**Purpose:** browse objective questions for practice (without answers). **Auth:** required.

| Param | Rules |
|---|---|
| `subjectId`, `topicId`, `questionBankId` | Optional UUIDs. Unknown id → 404. A `topicId` not belonging to the given `subjectId` → 400. |
| `difficulty` | Optional `EASY` \| `MEDIUM` \| `HARD`. |
| `examType` | Optional `UNIVERSITY` \| `CLAT_PG` \| `JUDICIARY` \| `AIBE` \| `UGC_NET` (extend the enum as content grows). |
| `page`, `size` | §0.4, `size` max 50. |
| `sort` | `createdAt` (default desc) or `displayOrder` (asc; meaningful with `questionBankId`). |

**200 OK** — `PagedResponse<QuestionSummary>`:

```json
{
  "content": [
    {
      "id": "q1…",
      "questionText": "Which Article guarantees equality before law?",
      "options": [
        { "key": "A", "text": "Article 12" },
        { "key": "B", "text": "Article 14" },
        { "key": "C", "text": "Article 19" },
        { "key": "D", "text": "Article 21" }
      ],
      "subject": { "id": "5e…", "name": "Constitutional Law" },
      "topic": { "id": "9a…", "name": "Fundamental Rights" },
      "difficulty": "EASY",
      "examType": "CLAT_PG",
      "sectionId": "0d6f…",
      "isFree": true,
      "attemptedByMe": false
    }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

**Rules:** only `OBJECTIVE` questions. **Never** include `correctOption`, `modelAnswer` or
`explanation` in this response. `attemptedByMe` = the user has an answered response for it in any
`EVALUATED` attempt. `subject`/`topic`/`difficulty`/`examType` may be `null` for legacy questions.
Empty → `200` with `content: []`.

**Errors:** 400 (bad enum/sort/page/size), 401, 404 (unknown filter id).

---

## I. Start a practice attempt

```http
POST /api/v1/practice/attempts
```

**Purpose:** start a quiz from filters (subject/topic/bank), with a question count. Complements
the existing `POST /practice/question-banks/{bankId}/attempts`, which stays as is.
**Auth:** required.

**Request body**

```json
{
  "subjectId": "5e…",
  "topicId": "9a…",
  "questionBankId": null,
  "difficulty": null,
  "examType": null,
  "questionCount": 20
}
```

| Field | Rules |
|---|---|
| `subjectId` / `topicId` / `questionBankId` | At least **one** is required (else 400). Same consistency rules as §H. |
| `difficulty`, `examType` | Optional filters. |
| `questionCount` | Optional, default 20, **1–50**. |

**201 Created** (`Location: /api/v1/practice/attempts/{attemptId}`)

```json
{
  "attemptId": "at1…",
  "status": "IN_PROGRESS",
  "startedAt": "2026-10-05T18:42:31Z",
  "questionCount": 20,
  "questions": [
    {
      "id": "q1…",
      "questionText": "Which Article guarantees equality before law?",
      "options": [
        { "key": "A", "text": "Article 12" },
        { "key": "B", "text": "Article 14" },
        { "key": "C", "text": "Article 19" },
        { "key": "D", "text": "Article 21" }
      ],
      "displayOrder": 1
    }
  ]
}
```

**Business rules**

- Candidate pool: `OBJECTIVE` questions matching all filters that the user may access (Pro-only
  questions excluded for free users).
- Selection: random, **preferring questions the user hasn't answered before**; fill up with
  previously answered ones if needed. Persist the chosen set and order in
  `practice_attempt_question` so the attempt is stable across reloads.
- Fewer candidates than `questionCount` → return what exists; `questionCount` reflects the real
  number.
- **Never** return `correctOption`, `modelAnswer` or `explanation` before submission.

**Errors**

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | No filter given; `questionCount` out of range; inconsistent subject/topic. |
| 401 | `UNAUTHORIZED` | |
| 404 | `NOT_FOUND` | Unknown filter id, or **no questions match** (`message: "No questions match these filters"`). |

---

## J. Submit a practice attempt

```http
POST /api/v1/practice/attempts/{attemptId}/submit
```

**Purpose:** submit answers, score synchronously, and return per-question results with
explanations. This **extends** the existing endpoint with an optional body; a body-less call
keeps working exactly as today (scores the answers already saved through
`POST /attempts/{id}/responses`). **Auth:** required.

**Request body (optional)**

```json
{
  "answers": [
    { "questionId": "q1…", "selectedOptionKey": "B" },
    { "questionId": "q2…", "selectedOptionKey": null }
  ]
}
```

| Field | Rules |
|---|---|
| `answers` | Optional array, max = attempt's question count. |
| `answers[].questionId` | Required; must belong to this attempt; no duplicates (else 400). |
| `answers[].selectedOptionKey` | One of the question's option keys, or `null` = skipped. Unknown key → 400. |

Answers in the body are upserted over any previously saved response, then the attempt is scored
— all in one transaction.

**200 OK**

```json
{
  "attemptId": "at1…",
  "status": "EVALUATED",
  "submittedAt": "2026-10-05T19:05:10Z",
  "attempted": 18,
  "correct": 14,
  "wrong": 4,
  "unanswered": 2,
  "accuracy": 77.8,
  "totalScore": 14,
  "maxScore": 20,
  "results": [
    {
      "questionId": "q1…",
      "questionText": "Which Article guarantees equality before law?",
      "options": [
        { "key": "A", "text": "Article 12" },
        { "key": "B", "text": "Article 14" },
        { "key": "C", "text": "Article 19" },
        { "key": "D", "text": "Article 21" }
      ],
      "selectedOptionKey": "B",
      "correctOptionKey": "B",
      "correct": true,
      "explanation": "Article 14 provides equality before law and equal protection of the laws.",
      "sectionId": "0d6f…"
    }
  ]
}
```

| Field | Definition |
|---|---|
| `attempted` | Questions in this attempt with a non-null answer. |
| `correct` / `wrong` | Among `attempted`; `wrong = attempted − correct`. |
| `unanswered` | `questionCount − attempted`. |
| `accuracy` | `correct / attempted × 100`, 1 decimal, `0` if `attempted = 0` (same formula as §C). |
| `totalScore` / `maxScore` | Sum of `max_marks` of correct answers / of all questions. |
| `results[]` | In `displayOrder`. `correctOptionKey` and `explanation` (nullable) are revealed **only** after submission. `sectionId` (nullable) lets the UI link to the provision. |

**Business rules:** scoring writes `is_correct` and `score` per response and sets
`submitted_at`, `status = EVALUATED`. These rows are exactly what §C aggregates, so Practice
Progress updates on the next Home load.

**Errors**

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Attempt already submitted (kept as 400 for consistency with the current endpoint); invalid/duplicate `questionId`; unknown option key. |
| 401 | `UNAUTHORIZED` | |
| 404 | `NOT_FOUND` | Attempt doesn't exist **or belongs to another user**. |

## K. Attempt history and result (supporting)

```http
GET /api/v1/practice/attempts?status=EVALUATED&page=0&size=20&sort=submittedAt,desc
GET /api/v1/practice/attempts/{attemptId}/result
```

- History: `PagedResponse` of `{ attemptId, status, startedAt, submittedAt, questionCount,
  attempted, correct, accuracy, subject: {id,name}|null, topic: {id,name}|null,
  questionBankId|null }`. `status` filter optional; sort whitelist `startedAt`, `submittedAt`.
  Only the caller's attempts.
- Result: extend the existing endpoint to return the same body as §J's 200 response. 400 if the
  attempt is still `IN_PROGRESS` (existing behaviour); 404 if not found / not owned.

---

## M. Data model

Table names marked *existing* are as described in the backend's master doc; confirm exact names
against migrations V1–V8 before writing V9. Don't redesign existing tables — only the additive
columns below are proposed.

### Reused as-is

`users` (`full_name` feeds `firstName`), `bare_acts`, `sections`, `case_laws`, `case_summaries`,
`question_banks`, `questions`, `test_attempts`, attempt responses, `subscriptions` /
`EntitlementService` (Pro checks).

### Additive columns on existing tables

| Table | Column | Purpose |
|---|---|---|
| `bare_acts` | `provision_label varchar(20) not null default 'Section'` | "Article" for the Constitution (§B, §F). |
| `questions` | `topic_id uuid null references topics(id)` | §H filters. |
| `questions` | `difficulty varchar(10) null` (`EASY`/`MEDIUM`/`HARD`) | §H. |
| `questions` | `exam_type varchar(20) null` | §H. |
| `questions` | `explanation text null` | §J — revealed only after submission. |
| `question_banks` | `subject_id uuid null`, `topic_id uuid null` | Map the existing free-text `topic` onto real topics over time; keep the text column. |
| `test_attempts` | `subject_id uuid null`, `topic_id uuid null`, `started_at timestamptz not null default now()`, `submitted_at timestamptz null` | §I–§K. Backfill `started_at` from `created_at`. |
| attempt responses | `is_correct boolean null`, `answered_at timestamptz null` | §C and §J. Backfill: `is_correct = (score >= max_marks)` for objective questions in evaluated attempts. Ensure `UNIQUE(attempt_id, question_id)` exists. |

### New tables (PostgreSQL DDL sketch for `V9__home_dashboard.sql`)

```sql
CREATE TABLE subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(150) NOT NULL,
  slug          varchar(150) NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE topics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name          varchar(150) NOT NULL,
  slug          varchar(150) NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug)
);

-- One row per (user, section) ever opened. Drives §D and the SECTION case of §F.
CREATE TABLE user_section_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id      uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  act_id          uuid NOT NULL REFERENCES bare_acts(id) ON DELETE CASCADE, -- denormalized for per-act aggregation
  completed       boolean NOT NULL DEFAULT false,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at  timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz NULL,
  open_count      int NOT NULL DEFAULT 1,
  UNIQUE (user_id, section_id)
);
CREATE INDEX ix_usp_user_act  ON user_section_progress (user_id, act_id);
CREATE INDEX ix_usp_user_last ON user_section_progress (user_id, last_opened_at DESC);

-- Polymorphic "last opened" log. Drives §F.
CREATE TABLE user_learning_activity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type      varchar(20) NOT NULL CHECK (content_type IN ('SECTION','CASE_LAW','TOPIC')),
  content_id        uuid NOT NULL,          -- no FK (polymorphic); validated in the service
  first_accessed_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at  timestamptz NOT NULL DEFAULT now(),
  access_count      int NOT NULL DEFAULT 1,
  UNIQUE (user_id, content_type, content_id)
);
CREATE INDEX ix_ula_user_last ON user_learning_activity (user_id, last_accessed_at DESC);

-- Fixed question set + order for attempts started via §I.
CREATE TABLE practice_attempt_questions (
  attempt_id    uuid NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  display_order int NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS ix_test_attempts_user_status ON test_attempts (user_id, status);
```

Notes:

- **Upserts:** use native `INSERT … ON CONFLICT … DO UPDATE` (`@Modifying @Query(nativeQuery =
  true)`) rather than read-then-save, so concurrent tabs can't create duplicates or lose
  `completed_at`.
- **Orphaned activity rows** (content deleted): §F skips them at read time; a nightly job (or the
  admin delete services) can purge them.
- **Retention:** `user_learning_activity` holds one row per item, not one per visit, so it grows
  with content × users, not with traffic. If a full timeline ("Recent activity") is wanted later,
  add an append-only `learning_events` table — not needed for these contracts.
