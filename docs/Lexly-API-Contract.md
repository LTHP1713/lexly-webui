# Lexly — API Contract (v1)

**Status:** Draft for review, 2026-10-13
**Audience:** backend (`lexly-backend`) and frontend (`lexly-webui`) developers
**Based on:** `Lexly-TDD.md` v2 (frozen 2026-10-12), `Lexly-Implementation-Plan.md` and `Lexly-Frontend-Implementation-Plan.md`. Live endpoints were documented from the code on `feature/epic1` (working tree, 2026-10-13).
**Replaces:** `lexly-webui/docs/HOME_DASHBOARD_API_CONTRACT.md` and the endpoint tables in `Lexly-Frontend-Development-Master-Doc.md` §2.

This is the single source of truth for request and response shapes. The TDD says **what** each feature does; this document says **exactly what goes over the wire**. When code and this document disagree, fix one of them in the same PR.

### Status labels

| Label | Meaning |
|---|---|
| **LIVE** | Implemented on `feature/epic1`. Shapes are copied from the code |
| **LIVE → Pn** | Implemented, but changes in backend Phase *n* (the change is described inline) |
| **PROPOSED** | Derived from the TDD for review. Becomes **AGREED** when backend and frontend sign it off at the start of the phase |
| **AGREED** | Signed off; both sides build against it |
| **ADDED** | Not in TDD §8; added here because a screen needs it. Needs a TDD addendum line when agreed |
| **REMOVED** | Deleted by TDD v2. Do not call |

Change process: edit this file in the backend repo, bump the "Changelog" table at the end, and mention the change in both progress files.

---

## 0. Conventions (apply to every endpoint)

### 0.1 Base path, auth and identity
- Base path: `/api/v1`. JSON in and out (`application/json; charset=UTF-8`) unless stated (multipart uploads, PDF downloads).
- Every endpoint needs `Authorization: Bearer <accessToken>` except `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` and `/actuator/health/**`.
- The caller is always the JWT principal. **No endpoint accepts the caller's own user id** in a path, query or body. College scope comes from the caller's `collegeId`, never from a parameter (the only exception is SUPERADMIN's explicit `collegeId` filter).
- **Out-of-scope reads return 404, not 403** (TDD §2.2): another college's ids, another professor's assessments and another student's answers all look like "doesn't exist". 403 is used only for *role* failures (`FORBIDDEN`), `PASSWORD_CHANGE_REQUIRED` and `COLLEGE_INACTIVE`.

### 0.2 Types

| Kind | Format | Example |
|---|---|---|
| Ids | UUID string | `"0d6f8a3e-1b9c-4e41-8f5a-6a1d2c7e9b40"` |
| Instants | ISO-8601 UTC with `Z` (`java.time.Instant`) | `"2026-10-13T09:15:00Z"` |
| Dates | `yyyy-MM-dd` (`LocalDate`) | `"1973-04-24"` |
| Marks | JSON number, a multiple of 0.5, at most 1 decimal (`NUMERIC(5,1)`) | `7.5` |
| Percentages | JSON number 0–100, 2 decimals | `71.88` |
| Enums | `UPPER_SNAKE` string | `"AI_EVALUATED"` |
| Lists | Always present; `[]` when empty, **never `null`** | |
| Optional scalars | Present with `null` when absent (never omitted) | |
| Counts | Never `null`; `0` when there is no data | |

### 0.3 Errors
Every non-2xx response uses `common.dto.ErrorResponse`:

```json
{ "error": "VALIDATION_ERROR", "message": "title: must not be blank, dueAt: must be in the future" }
```

- `error` is a stable code (§0.8). Clients switch on it, never on `message`.
- `message` is safe to show to users. For `VALIDATION_ERROR` it is a comma-joined list of `path: reason`, where `path` is the request field path, with list indexes for nested fields (`questions[3].maxMarks: must be a multiple of 0.5`). The frontend maps paths onto inputs, so **keep paths equal to the request JSON field names**.
- Never include stack traces, SQL or internal class names.

### 0.4 Pagination and sorting
List endpoints that can grow return `PagedResponse<T>`:

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }
```

- Query `page` (0-based, default 0) and `size` (default 20, max 100). **Proposed for all endpoints (P0):** out-of-range values → `400 VALIDATION_ERROR`. Today `/sections/search` and `/caselaws` don't validate them.
- Sorting: `sort=<field>,<asc|desc>`, with a whitelist per endpoint. An unknown field → 400.
- Small, bounded lists (acts, sections of an act, subjects, a college's admins) are returned as plain arrays.

### 0.5 Caching
- Shared content GETs (`/acts`, `/acts/{id}/sections`, `/sections/{id}`, `/caselaws` without `q`, `/caselaws/{id}`): `Cache-Control: private, max-age=300` with a weak `ETag`.
- Searches (`/sections/search`, `/caselaws?q=`) and **every user-, college- or file-specific endpoint**: `Cache-Control: no-store`.

### 0.6 Files
- **Uploads:** `multipart/form-data` with one part named `file`. PDFs are checked server-side: content-type `application/pdf`, `%PDF-` magic bytes, size ≤ `lexly.storage.max-file-mb`, pages ≤ `lexly.storage.max-pages` (values decided in Phase 3). Any failure → `400 INVALID_FILE` with a message naming the limit.
- **Downloads:** `200` with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<safe name>"`, `Cache-Control: no-store`. CORS must expose `Content-Disposition` (P3).
- File names are never taken from user input for storage. `originalFilename` is kept only for display.

### 0.7 Roles

| Today (LIVE) | After Phase 1 (V15 remap) |
|---|---|
| `ADMIN` | `SUPERADMIN` |
| `STUDENT`, `LAWYER` | `S_STUDENT` |
| — | `C_ADMIN`, `C_PROFESSOR`, `C_STUDENT` |

Each endpoint below lists the roles that may call it. Other roles get `403 FORBIDDEN`.

### 0.8 Error code registry

| Code | HTTP | Status | Raised when |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | LIVE | Bean validation, malformed JSON, business-rule validation |
| `UNAUTHORIZED` | 401 | LIVE | Missing/invalid/expired access token; wrong credentials; invalid refresh token |
| `FORBIDDEN` | 403 | LIVE | Role not allowed |
| `NOT_FOUND` | 404 | LIVE | Unknown id, unknown route, or out of scope (§0.1) |
| `EMAIL_ALREADY_EXISTS` | 409 | LIVE | Register / create user with a used email |
| `SHORT_CODE_ALREADY_EXISTS` | 409 | LIVE | Act short code taken |
| `SECTION_NUMBER_ALREADY_EXISTS` | 409 | LIVE | Section number taken within the act |
| `BULK_IMPORT_REJECTED` | 422 | LIVE → P0 (removed) | All-or-nothing bulk import found problems |
| `INTERNAL_ERROR` | 500 | LIVE | Unhandled |
| `RATE_LIMITED` | 429 | PROPOSED (P1) | Redis limiter rejected the call (login, uploads, AI) |
| `PASSWORD_CHANGE_REQUIRED` | 403 | PROPOSED (P1) | `mustChangePassword` is set and the endpoint isn't allowed (§2.4) |
| `COLLEGE_INACTIVE` | 403 | PROPOSED (P1) | Login/refresh for a user whose college is deactivated, after a correct password |
| `COLLEGE_CODE_ALREADY_EXISTS` | 409 | ADDED (P1) | College code taken |
| `LOGIN_ID_ALREADY_EXISTS` | 409 | ADDED (P2) | Roll no / employee ID already used in the college |
| `SUBJECT_CODE_ALREADY_EXISTS` | 409 | ADDED (P2) | Subject code already used in the college |
| `IMPORT_FILE_INVALID` | 400 | PROPOSED (P2) | Unreadable file, wrong headers, > 2,000 rows, wrong format |
| `SUBJECT_IN_USE` | 409 | PROPOSED (P2) | Deleting a subject that has assessments |
| `ASSESSMENT_NOT_EDITABLE` | 409 | PROPOSED (P3) | Edit/delete/publish on a non-`DRAFT` assessment, or remove on a `DRAFT` |
| `ASSESSMENT_CLOSED` | 409 | PROPOSED (P3) | Upload/submit after `dueAt` or on a closed/removed assessment |
| `ANSWER_LOCKED` | 409 | PROPOSED (P3) | Upload/submit on an already `SUBMITTED` answer |
| `INVALID_FILE` | 400 | PROPOSED (P3) | Upload failed the §0.6 checks |
| `INVALID_MARKS` | 400 | PROPOSED (P4) | Marks < 0, > max, or not a multiple of 0.5 |
| `GRADE_PUBLISHED` | 409 | PROPOSED (P4) | Changing a published grade |
| `AI_EVALUATION_NOT_ALLOWED` | 409 | PROPOSED (P5) | AI evaluate before the PDF was downloaded, on a published grade, or while one is running (also used for a solo attempt while another is evaluating) |
| `PLAN_REQUIRED` | 402 | PROPOSED (P7) | Solo feature without an `ACTIVE` plan |
| `QUOTA_EXCEEDED` | 429 | PROPOSED (P7) | 60 generations already used this month |
| `ATTEMPT_LIMIT_REACHED` | 409 | PROPOSED (P7) | 4th evaluated attempt on a solo question |
| `FOLLOWUP_LIMIT_REACHED` | — | REMOVED (P0) | Old AI design; delete from `ErrorCodes` |

> Note on 401 vs. validation: the web client treats **every** 401 as "refresh the session and retry". Endpoints that check a password for an already-signed-in user (change password) must therefore return `400 VALIDATION_ERROR`, not 401, for a wrong current password.

### 0.9 Rate limits (P1 / P8)

| Scope | Limit (initial) | Key |
|---|---|---|
| `POST /auth/login` | 10/min per IP **and** 5/min per account identifier | IP; email or `collegeCode:loginId` |
| Uploads (`PUT …/answer`, solo attempts, user imports) | 20/min per user | user id |
| AI endpoints (`ai-evaluate`, solo generate) | 30/min per user | user id |

All return `429 RATE_LIMITED` with a `Retry-After` header (seconds).

---

## 1. Auth

### 1.1 `POST /auth/register` — LIVE → P1
Public. Always creates `STUDENT` today and `S_STUDENT` from Phase 1. Any `role` field in the body is ignored.

Request:
```json
{ "email": "priya@example.com", "password": "s3cret-pass", "fullName": "Priya Sharma" }
```

| Field | Rules |
|---|---|
| `email` | required, valid email |
| `password` | required, ≥ 8 chars |
| `fullName` | required, non-blank |

`201 Created` + `Set-Cookie: lexly_refresh_token=…; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000`

```json
{
  "userId": "7b1e4c0a-2f4d-4f7e-9a51-0c3a1f6d2b11",
  "email": "priya@example.com",
  "fullName": "Priya Sharma",
  "accessToken": "eyJ…",
  "refreshToken": "q9Zr…"
}
```

**P1 change:** the response adds `role` and `mustChangePassword` (see §1.2), so the client can route without decoding the JWT.

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`.

### 1.2 `POST /auth/login` — LIVE → P1
Public.

**LIVE** request: `{ "email", "password" }`. Response: same as register, `200`.

**P1** request — exactly one of two shapes:
```json
{ "email": "admin@nlsiu.ac.in", "password": "…" }
```
```json
{ "collegeCode": "NLSIU", "loginId": "21BAL042", "password": "…" }
```

| Field | Rules |
|---|---|
| `email` | Email mode: SUPERADMIN, C_ADMIN, S_STUDENT |
| `collegeCode` | College mode: case-insensitive, normalised to upper case |
| `loginId` | College mode: roll no (C_STUDENT) or employee ID (C_PROFESSOR); trimmed, case-sensitive |
| `password` | required |

Both or neither mode → `400 VALIDATION_ERROR`.

`200 OK` + refresh cookie:
```json
{
  "userId": "…",
  "email": "student@nlsiu.ac.in",
  "fullName": "Arjun Rao",
  "role": "C_STUDENT",
  "mustChangePassword": true,
  "accessToken": "eyJ…",
  "refreshToken": "q9Zr…"
}
```

JWT claims (P1): `sub`, `role`, `collegeId` (null for SUPERADMIN and S_STUDENT), `mustChangePassword`. Clients should still use `GET /users/me` as the source of truth.

Errors:
- `401 UNAUTHORIZED`, `"Invalid credentials"`, for **every** credential failure: unknown user, wrong password, email login for a college account, college login for an email account, inactive user, unknown college code.
- `403 COLLEGE_INACTIVE` only **after** a correct password, for C_* users of a deactivated college.
- `429 RATE_LIMITED`.

### 1.3 `POST /auth/refresh` — LIVE
Public. The refresh token comes from the cookie (browsers) or the body `{ "refreshToken" }` (mobile). The body wins if both are present. The token is rotated: the old one is revoked.

`200 OK` + new cookie:
```json
{ "accessToken": "eyJ…", "refreshToken": "n3wT…" }
```

Errors:
- `400 VALIDATION_ERROR` — no token in the body or cookie (`"refreshToken: must not be blank"`)
- `401 UNAUTHORIZED` — unknown, expired or revoked token
- **P1:** `403 COLLEGE_INACTIVE`

Access token TTL is 15 min; refresh token TTL is 30 days.

### 1.4 `POST /auth/logout` — LIVE
Public, idempotent. Revokes the token from the body or cookie if there is one, and always clears the cookie. `204 No Content`.

### 1.5 `POST /auth/change-password` — PROPOSED (P1)
Any signed-in role. Allowed while `mustChangePassword` is set.

Request:
```json
{ "currentPassword": "21BAL042", "newPassword": "a-much-better-one" }
```

| Field | Rules |
|---|---|
| `currentPassword` | required; wrong → `400 VALIDATION_ERROR` `"currentPassword: is incorrect"` (not 401, see §0.8) |
| `newPassword` | required, ≥ 8 chars, ≠ `currentPassword`, ≠ the user's `loginId` |

`200 OK` + new refresh cookie. Every other refresh token of the user is revoked:
```json
{ "accessToken": "eyJ…", "refreshToken": "n3wT…", "mustChangePassword": false }
```

Errors: `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### 1.6 `PASSWORD_CHANGE_REQUIRED` gate — PROPOSED (P1)
While `mustChangePassword` is true, every endpoint except `POST /auth/change-password`, `POST /auth/logout`, `POST /auth/refresh` and `GET /users/me` returns `403 PASSWORD_CHANGE_REQUIRED`.

---

## 2. Current user

### 2.1 `GET /users/me` — LIVE → P1
Any signed-in role. `Cache-Control: no-store`.

**LIVE:**
```json
{
  "id": "7b1e4c0a-…",
  "email": "priya@example.com",
  "firstName": "Priya",
  "fullName": "Priya Sharma",
  "role": "STUDENT",
  "createdAt": "2026-09-23T10:15:00Z"
}
```

`firstName` is the first whitespace-separated word of `fullName`, or `null` if `fullName` is blank. It is never derived from the email.

**P1 adds:**

| Field | Type | Notes |
|---|---|---|
| `mustChangePassword` | boolean | Drives the forced-change screen |
| `loginId` | string \| null | Roll no / employee ID; `null` for email-login roles |
| `college` | object \| null | `{ "id", "code", "name" }` for C_* roles; `null` otherwise |

Errors: `401` (also when the token's user no longer exists).

---

## 3. Bare acts & sections (read)

All signed-in roles. LIVE.

### 3.1 `GET /acts`
`200` `BareActSummary[]`, ordered by title:
```json
[{ "id": "…", "title": "The Indian Contract Act, 1872", "shortCode": "ICA" }]
```

### 3.2 `GET /acts/{actId}/sections`
`200` `SectionSummary[]` in the act's natural order:
```json
[{ "id": "…", "sectionNumber": "2", "title": "Interpretation-clause" }]
```
`404 NOT_FOUND` for an unknown act. (Ordering: the client also sorts naturally as a safety net, but the server is the source of truth.)

### 3.3 `GET /sections/{sectionId}`
`200 SectionResponse`:
```json
{
  "id": "…",
  "sectionNumber": "2",
  "title": "Interpretation-clause",
  "bodyText": "In this Act the following words and expressions are used …",
  "inSimpleWords": "This section defines the building blocks of a contract …",
  "provisionMeaning": [
    { "clause": "(a)", "title": "Proposal", "explanation": "…" }
  ],
  "illustrations": [
    { "id": "…", "text": "A offers to sell his car to B for ₹5 lakh …", "hypothetical": true }
  ],
  "exceptions": [
    {
      "id": "…",
      "title": "Agreements without consideration",
      "explanation": "…",
      "illustrations": [{ "id": "…", "text": "…", "hypothetical": false }]
    }
  ],
  "keyLegalTerms": [{ "term": "Promisor", "definition": "The person making the proposal." }],
  "actId": "…",
  "actTitle": "The Indian Contract Act, 1872",
  "prev": { "id": "…", "sectionNumber": "1", "title": "Short title" },
  "next": null
}
```

| Field | Notes |
|---|---|
| `inSimpleWords` | nullable |
| `provisionMeaning[].clause`, `.title` | nullable; `explanation` required |
| `illustrations[].hypothetical` | `true` = written by Lexly; `false` = from the Act |
| `exceptions[].title` | nullable |
| All lists | ordered by `display_order`; never `null` |
| `prev` / `next` | neighbours in natural order; `null` at either end |

`404 NOT_FOUND` for an unknown section.

### 3.4 `GET /sections/search?q=&page=&size=`
`q` is required. `200 PagedResponse<SectionSearchResult>`:
```json
{ "content": [{ "id": "…", "sectionNumber": "10", "title": "What agreements are contracts", "snippet": "All agreements are <b>contracts</b> if …" }],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1 }
```

`snippet` can contain only `<b>…</b>` around matched terms; everything else is plain text. Clients must render nothing but that tag. A missing `q` → `400`.

---

## 4. Case laws (read)

All signed-in roles. LIVE.

### 4.1 `GET /caselaws?q=&importance=&sectionId=&page=&size=`

| Param | Notes |
|---|---|
| `q` | optional; matches title, citation, court, case number, judges |
| `importance` | optional `LANDMARK` \| `IMPORTANT` \| `STANDARD` |
| `sectionId` | optional; cases linked to that section |

`200 PagedResponse<CaseLawSummary>`:
```json
{ "content": [{ "id": "…", "title": "Mohori Bibee v. Dharmodas Ghose", "citation": "(1903) 30 IA 114",
                "court": "Privy Council", "importance": "LANDMARK" }],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1 }
```

### 4.2 `GET /caselaws/{id}`
`200 CaseLawResponse`:
```json
{
  "id": "…",
  "title": "Association for Democratic Reforms v. Election Commission of India",
  "citation": "2025 INSC 1234",
  "court": "Supreme Court of India",
  "caseNumber": "W.P.(C) No. 640 of 2025",
  "decidedOn": "2025-08-14",
  "bench": "Division Bench",
  "judges": "Surya Kant J., Joymalya Bagchi J.",
  "jurisdiction": "Original",
  "caseType": "WRIT_PETITION",
  "importance": "LANDMARK",
  "sourcePdfUrl": "https://…",
  "onlineSummary": "…",
  "background": "…",
  "issues": [{ "issueNumber": 1, "question": "…", "reasoning": "…", "finding": "…" }],
  "arguments": { "PETITIONER": ["…"], "RESPONDENT": ["…"] },
  "finalHolding": { "summary": "…", "outcome": "SIR_UPHELD_WITH_DIRECTIONS" },
  "ratioDecidendi": ["…"],
  "obiterDicta": ["…"],
  "importantProvisions": [{ "law": "Representation of the People Act, 1950", "provision": "Section 21", "relevance": "…" }],
  "legalPrinciples": [{ "title": "…", "explanation": "…" }],
  "relatedSections": [{ "id": "…", "sectionNumber": "11", "title": "Who are competent to contract" }]
}
```

| Field | Notes |
|---|---|
| Scalars except `id`, `title` | nullable |
| `arguments` | keys from `PartyType` (`PETITIONER, APPELLANT, RESPONDENT, STATE, INTERVENOR, AMICUS`), in that order; only parties that have arguments |
| `finalHolding` | `null` when absent; `outcome` is free text, often a code-like string |
| `caseType` | free text, often a code (`WRIT_PETITION`); the client humanises it |
| `sourcePdfUrl` | clients link it only if it is `http(s)` |

`404 NOT_FOUND` for an unknown id.

---

## 5. Content administration

Role: `ADMIN` today, `SUPERADMIN` from P1 (TDD §7.1). All LIVE unless marked otherwise. Writes return `no-store`.

### 5.1 Acts

| Method & path | Body | Success |
|---|---|---|
| `POST /admin/acts` | `ActRequest` | `201 ActResponse` |
| `PUT /admin/acts/{actId}` | `ActRequest` | `200 ActResponse` |
| `DELETE /admin/acts/{actId}` | — | `204` (cascades to its sections) |

```json
// ActRequest
{ "title": "The Indian Contract Act, 1872", "shortCode": "ICA", "description": "…" }
// ActResponse
{ "id": "…", "title": "…", "shortCode": "ICA", "description": "…", "createdAt": "…" }
```

Rules: `title` required, ≤ 255; `shortCode` ≤ 50, unique (`409 SHORT_CODE_ALREADY_EXISTS`); `description` optional.

**ADDED (P1):** `GET /admin/acts/{actId}` → `ActResponse` (the admin form needs `description`, which `GET /acts` doesn't return).

### 5.2 Sections

| Method & path | Body | Success |
|---|---|---|
| `POST /admin/acts/{actId}/sections` | `SectionRequest` | `201 AdminSectionResponse` |
| `PUT /admin/sections/{sectionId}` | `SectionRequest` (full replace, including nested lists) | `200 AdminSectionResponse` |
| `DELETE /admin/sections/{sectionId}` | — | `204` |

```json
// SectionRequest
{
  "sectionNumber": "2",
  "title": "Interpretation-clause",
  "bodyText": "…",
  "inSimpleWords": "…",
  "provisionMeaning": [{ "clause": "(a)", "title": "Proposal", "explanation": "…", "displayOrder": 0 }],
  "illustrations": [{ "text": "…", "hypothetical": true, "displayOrder": 0 }],
  "exceptions": [{ "title": "…", "explanation": "…", "displayOrder": 0,
                   "illustrations": [{ "text": "…", "hypothetical": false }] }],
  "keyLegalTerms": [{ "term": "Promisor", "definition": "…", "displayOrder": 0 }]
}
```

| Field | Rules |
|---|---|
| `sectionNumber` | required, ≤ 20, unique within the act (`409 SECTION_NUMBER_ALREADY_EXISTS`) |
| `title` | ≤ 500 |
| `bodyText` | required |
| `provisionMeaning` | ≤ 100 items; `clause` ≤ 20, `title` ≤ 300, `explanation` required |
| `illustrations` | ≤ 50 items; `text` required; `hypothetical` defaults to `false` |
| `exceptions` | ≤ 50 items; `title` ≤ 300, `explanation` required (alias `text` accepted), nested `illustrations` ≤ 50 |
| `keyLegalTerms` | ≤ 100 items; `term` ≤ 200, `definition` required |
| `displayOrder` | optional, ≥ 0; when omitted, list position is used |

`AdminSectionResponse` = `{ id, bareActId, sectionNumber, title, bodyText, createdAt, inSimpleWords, provisionMeaning[], illustrations[], exceptions[], keyLegalTerms[] }`. Illustration and exception items here also carry `sectionId` and `displayOrder`.

**ADDED (P1):** `GET /admin/sections/{sectionId}` → `AdminSectionResponse`, so the editor loads exactly what it will `PUT`.

### 5.3 Illustrations & exceptions (per item)

| Method & path | Body | Success |
|---|---|---|
| `POST /admin/sections/{sectionId}/illustrations` | `{ text, hypothetical?, displayOrder? }` | `201` illustration |
| `PUT /admin/illustrations/{id}` | same | `200` |
| `DELETE /admin/illustrations/{id}` | — | `204` |
| `PUT /admin/sections/{sectionId}/illustrations/reorder` | `{ "orderedIds": [ … ] }` | `200` illustration[] |
| `POST /admin/sections/{sectionId}/exceptions` | `{ title?, explanation, displayOrder?, illustrations? }` | `201` exception |
| `PUT /admin/exceptions/{id}` | same | `200` |
| `DELETE /admin/exceptions/{id}` | — | `204` |
| `PUT /admin/sections/{sectionId}/exceptions/reorder` | `{ "orderedIds": [ … ] }` | `200` exception[] |

Reorder rule: `orderedIds` must be **exactly** the current ids of that section (no additions, omissions or duplicates), else `400 VALIDATION_ERROR`.

### 5.4 Case laws

| Method & path | Body | Success |
|---|---|---|
| `POST /admin/caselaws` | `CaseLawRequest` | `201 AdminCaseLawResponse` |
| `PUT /admin/caselaws/{id}` | `CaseLawRequest` (metadata only) | `200 AdminCaseLawResponse` |
| `DELETE /admin/caselaws/{id}` | — | `204` (cascades content and section links) |
| `PUT /admin/caselaws/{id}/content` | `CaseLawContentRequest` (full replace) | `200` `CaseLawResponse` (§4.2) |
| `POST /admin/caselaws/{id}/sections/{sectionId}` | — | `200 SectionSummary[]` (the case's linked sections, after linking; idempotent) |
| `DELETE /admin/caselaws/{id}/sections/{sectionId}` | — | `200 SectionSummary[]` (after unlinking) |

```json
// CaseLawRequest
{ "title": "…", "citation": "…", "court": "…", "caseNumber": "…", "decidedOn": "2025-08-14",
  "bench": "…", "judges": "…", "jurisdiction": "…", "caseType": "WRIT_PETITION",
  "importance": "LANDMARK", "sourcePdfUrl": "https://…" }
// AdminCaseLawResponse
{ "id": "…", "title": "…", "citation": "…", "court": "…", "caseNumber": "…", "decidedOn": "…",
  "bench": "…", "judges": "…", "jurisdiction": "…", "caseType": "…", "importance": "LANDMARK",
  "sourcePdfUrl": "…", "linkedSections": [ /* SectionSummary */ ], "createdAt": "…" }
// CaseLawContentRequest
{
  "onlineSummary": "…",
  "background": "…",
  "finalHolding": { "summary": "…", "outcome": "…" },
  "issues": [{ "question": "…", "reasoning": "…", "finding": "…" }],
  "arguments": [{ "partyType": "PETITIONER", "argument": "…" }],
  "ratioDecidendi": ["…"],
  "obiterDicta": ["…"],
  "importantProvisions": [{ "law": "…", "provision": "…", "relevance": "…" }],
  "legalPrinciples": [{ "title": "…", "explanation": "…" }]
}
```

| Field | Rules |
|---|---|
| `title` | required, ≤ 500 |
| `citation`, `caseNumber`, `judges`, `sourcePdfUrl` | ≤ 500 |
| `court` | ≤ 255 |
| `bench`, `jurisdiction`, `caseType` | ≤ 100 |
| `issues` | ≤ 50; `question` required |
| `arguments` | ≤ 100; `partyType` and `argument` required. Order within a party = list order |
| `ratioDecidendi`, `obiterDicta` | ≤ 50 non-blank strings |
| `importantProvisions` | ≤ 100; `law` ≤ 255 and `provision` ≤ 100, both required |
| `legalPrinciples` | ≤ 50; `title` ≤ 255 and `explanation` required |
| `finalHolding.outcome` | ≤ 255 |

Sequence numbers (`issueNumber` etc.) are assigned by the server from list order and never sent.

### 5.5 Bulk JSON import — LIVE → P0

| Method & path | Body | Limits |
|---|---|---|
| `POST /admin/bulk/acts` | `{ "acts": [ { title, shortCode, description } ] }` | ≤ 10 acts; `shortCode` required here |
| `POST /admin/bulk/sections` | `{ "actShortCode": "ICA", "sections": [ { sectionNumber, title, bodyText, illustrations: [string], exceptions: [string] } ] }` | ≤ 100 sections; ≤ 50 illustrations/exceptions each |
| `POST /admin/bulk/caselaws` | `{ "caseLaws": [ { …CaseLawRequest, "citation" required, "content": CaseLawContentRequest, "sections": [ { actShortCode, sectionNumber } ] } ] }` | ≤ 10 cases; ≤ 50 section refs each |

**LIVE behaviour (all-or-nothing):** any problem → `422 BULK_IMPORT_REJECTED`, `"N problem(s), nothing was inserted: items[i].field: reason; …"`. Success → `201`:
```json
{ "counts": { "acts": 2 }, "created": [{ "id": "…", "key": "ICA" }] }
```

**P0 behaviour (per row, TDD §7.1) — PROPOSED.** Each row runs in its own transaction. The response is always `200` unless the envelope itself is invalid (`400`, e.g. empty list or too many rows):
```json
{
  "summary": { "total": 12, "created": 10, "rejected": 1, "failed": 1 },
  "rows": [
    { "index": 0, "key": "ICA-2",  "status": "CREATED",  "id": "…", "errors": [] },
    { "index": 4, "key": "ICA-10", "status": "REJECTED", "id": null, "errors": ["sectionNumber: duplicate of row 1"] },
    { "index": 7, "key": "ICA-17", "status": "FAILED",   "id": null, "errors": ["Unexpected error while saving"] }
  ]
}
```

| Field | Notes |
|---|---|
| `rows` | **every** row, in request order |
| `index` | 0-based position in the request list |
| `key` | acts: `shortCode`; sections: `"{actShortCode}-{sectionNumber}"`; case laws: `citation` |
| `status` | `CREATED` \| `REJECTED` (validation, duplicate in batch or DB, missing parent) \| `FAILED` (unexpected) |
| `errors` | `path: reason` strings, with paths relative to the row |

This `BulkImportResult` shape is reused by user imports (§8.3), which add `CONVERTED`.

---

## 6. Colleges & C_ADMIN accounts (SUPERADMIN) — PROPOSED (P1)

### 6.1 Colleges

| Method & path | Body | Success |
|---|---|---|
| `GET /superadmin/colleges?q=&active=&page=&size=&sort=name,asc` | — | `200 PagedResponse<CollegeSummary>` |
| `POST /superadmin/colleges` | `{ "code", "name" }` | `201 CollegeDetail` |
| `GET /superadmin/colleges/{id}` (ADDED) | — | `200 CollegeDetail` |
| `PUT /superadmin/colleges/{id}` | `{ "name", "active" }` | `200 CollegeDetail` |

```json
// CollegeSummary / CollegeDetail
{
  "id": "…",
  "code": "NLSIU",
  "name": "National Law School of India University",
  "active": true,
  "counts": { "admins": 2, "professors": 41, "students": 1180 },
  "createdAt": "…",
  "updatedAt": "…"
}
```

| Field | Rules |
|---|---|
| `code` | required, 2–20 chars, `[A-Z0-9]+` after upper-casing, unique (`409 COLLEGE_CODE_ALREADY_EXISTS`). **Immutable** after creation, because it is part of every college login |
| `name` | required, ≤ 255 |
| `active` | `false` blocks login and refresh for every user of the college (`COLLEGE_INACTIVE`). Existing access tokens expire within 15 min |
| `q` | matches code or name |
| sort | whitelist `name`, `code`, `createdAt` |

There is no delete; deactivate instead.

### 6.2 C_ADMIN accounts

| Method & path | Body | Success |
|---|---|---|
| `GET /superadmin/colleges/{id}/admins` | — | `200 UserSummary[]` |
| `POST /superadmin/colleges/{id}/admins` | `{ "fullName", "email", "temporaryPassword" }` | `201 UserSummary` |
| `POST /superadmin/admins/{userId}/reset-password` | `{ "temporaryPassword" }` | `204` |
| `DELETE /superadmin/admins/{userId}` | — | `204` |

```json
// UserSummary (shared by every user list)
{ "id": "…", "fullName": "Meera Iyer", "email": "meera@nlsiu.ac.in", "role": "C_ADMIN",
  "loginId": null, "mustChangePassword": true, "createdAt": "…" }
```

- `temporaryPassword` must be ≥ 8 chars. The new or reset account always has `mustChangePassword = true`, and a reset revokes all of the user's refresh tokens. (Open item O1: the alternative is a server-generated password returned once.)
- `email` must be unique across the platform: `409 EMAIL_ALREADY_EXISTS`.
- An id that isn't a C_ADMIN → `404`.

---

## 7. Audit log — PROPOSED (P1)

`GET /audit?collegeId=&action=&actorId=&entityType=&from=&to=&page=&size=`

Roles: SUPERADMIN (all colleges; `collegeId` optional) and C_ADMIN (own college only; a `collegeId` for another college → `404`). Sorted by `createdAt desc`. `from`/`to` are Instants, with `to` exclusive.

`200 PagedResponse<AuditEvent>`:
```json
{
  "id": "…",
  "createdAt": "2026-10-13T09:15:00Z",
  "actor": { "id": "…", "fullName": "Meera Iyer", "role": "C_ADMIN" },
  "college": { "id": "…", "code": "NLSIU", "name": "…" },
  "action": "USER_IMPORT",
  "entityType": "USER",
  "entityId": null,
  "details": { "kind": "STUDENTS", "total": 1200, "created": 1180, "converted": 4, "rejected": 16, "failed": 0 }
}
```

- `actor` is `null` for system events or deleted users.
- `action` values (from TDD §11.1): `LOGIN_FAILED`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `COLLEGE_CREATED`, `COLLEGE_UPDATED`, `USER_CREATED`, `USER_UPDATED`, `USER_REMOVED`, `USER_IMPORT`, `CONTENT_IMPORT`, `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_DELETED`, `SUBJECT_PROFESSORS_CHANGED`, `ASSESSMENT_PUBLISHED`, `ASSESSMENT_REMOVED`, `AI_EVALUATION_REQUESTED`, `GRADE_EDITED`, `GRADE_PUBLISHED`, `SOLO_PLAN_CHANGED`, `SOLO_QUOTA_RESET`.
- `details` is free-form JSON. It never contains passwords, tokens, answer text or feedback.
- Rows are purged after 30 days.

---

## 8. College administration (C_ADMIN) — PROPOSED (P2)

### 8.1 Users

| Method & path | Body | Success |
|---|---|---|
| `GET /college/users?role=&q=&page=&size=&sort=fullName,asc` | — | `200 PagedResponse<UserSummary>` |
| `POST /college/users` | `{ "role", "fullName", "email", "loginId" }` | `201 UserSummary` |
| `GET /college/users/{id}` (ADDED) | — | `200 UserSummary` |
| `PUT /college/users/{id}` | `{ "fullName", "email", "loginId" }` | `200 UserSummary` |
| `POST /college/users/{id}/reset-password` | — | `204` |
| `DELETE /college/users/{id}` | — | `204` |

| Field | Rules |
|---|---|
| `role` | `C_STUDENT` \| `C_PROFESSOR` (filter and create) |
| `fullName` | required, ≤ 255 |
| `email` | required, platform-unique (`409 EMAIL_ALREADY_EXISTS`) |
| `loginId` | required, ≤ 50, unique within the college across both roles (`409 LOGIN_ID_ALREADY_EXISTS`) |
| `q` | matches name, email, login ID |
| sort | whitelist `fullName`, `loginId`, `createdAt` |

- Reset password sets the password to `loginId`, sets `mustChangePassword = true` and revokes refresh tokens.
- Delete is a hard delete per TDD §4.7. A student's answers, files, grades and grade history go with them; a professor's assessments remain with `createdBy = null`.
- Ids outside the college, or C_ADMIN ids → `404`.

### 8.2 Import templates
The templates are static files shipped by the web app (`/templates/students.csv|xlsx`, `/templates/professors.csv|xlsx`). Headers are exactly `full_name,email,roll_no` and `full_name,email,employee_id`.

### 8.3 Bulk user import

| Method & path | Body | Success |
|---|---|---|
| `POST /college/users/import/students` | multipart `file` (`.csv` or `.xlsx`) | `200 BulkImportResult` |
| `POST /college/users/import/professors` | multipart `file` | `200 BulkImportResult` |

- `BulkImportResult` is as in §5.5, with `status` ∈ `CREATED | CONVERTED | REJECTED | FAILED` and `summary.converted` added.
- `index` is the **spreadsheet row number** (the header is row 1, so the first data row is 2); `key` = `loginId`.
- `CONVERTED` (students only): the email belonged to an `S_STUDENT`, who is now a `C_STUDENT` of this college. Their solo data is deleted and the password is reset to the roll no (§4.6).
- Rejection reasons include: missing field, bad email, duplicate email or ID within the file (`"duplicate of row 7"`), ID already used in the college, and email used by a non-S_STUDENT.
- Errors: `400 IMPORT_FILE_INVALID` (unreadable, wrong or missing headers, > 2,000 data rows, not CSV/XLSX), `429 RATE_LIMITED`.

### 8.4 Subjects

| Method & path | Roles | Body | Success |
|---|---|---|---|
| `GET /college/subjects?q=` | C_ADMIN, C_PROFESSOR (mapped only), C_STUDENT | — | `200 Subject[]` |
| `GET /college/subjects/{id}` (ADDED) | same scoping | — | `200 Subject` |
| `POST /college/subjects` | C_ADMIN | `{ "code", "name", "description" }` | `201 Subject` |
| `PUT /college/subjects/{id}` | C_ADMIN | same | `200 Subject` |
| `DELETE /college/subjects/{id}` | C_ADMIN | — | `204` / `409 SUBJECT_IN_USE` |
| `PUT /college/subjects/{id}/professors` | C_ADMIN | `{ "professorIds": [ … ] }` | `200 Subject` |

```json
// Subject
{
  "id": "…",
  "code": "CON-101",
  "name": "Constitutional Law I",
  "description": "…",
  "professors": [{ "id": "…", "fullName": "Dr. K. Menon" }],
  "assessmentCount": 3,
  "createdAt": "…",
  "updatedAt": "…"
}
```

- `code` is required, ≤ 30, unique within the college (`409 SUBJECT_CODE_ALREADY_EXISTS`). `name` is required, ≤ 255.
- `professorIds` **replaces** the mapping. An id that isn't a C_PROFESSOR of this college → `400 VALIDATION_ERROR` (`"professorIds[2]: not a professor of this college"`).
- Sorted by `name`.

---

## 9. Assessments & answering — PROPOSED (P3)

### 9.1 Shared enums

| Enum | Values |
|---|---|
| `AssessmentStatus` | `DRAFT`, `PUBLISHED`, `CLOSED`, `REMOVED` |
| `AnswerStatus` | `UPLOADED`, `SUBMITTED` |
| `CellStatus` (grid) | `NOT_UPLOADED`, `UPLOADED`, `SUBMITTED`, `NOT_ATTEMPTED` (closed without a submission) |
| `StudentAssessmentState` | `OPEN`, `PARTIALLY_SUBMITTED`, `SUBMITTED`, `CLOSED`, `RESULTS_AVAILABLE` |
| `GradeStatus` (P4/P5) | `PENDING`, `AI_EVALUATING`, `AI_EVALUATED`, `AI_FAILED`, `PUBLISHED` |

### 9.2 Professor: assessments

| Method & path | Body | Success |
|---|---|---|
| `GET /professor/assessments?subjectId=&status=&page=&size=&sort=dueAt,desc` | — | `200 PagedResponse<ProfessorAssessmentSummary>` |
| `POST /professor/assessments` | `AssessmentDraft` | `201 AssessmentDetail` |
| `GET /professor/assessments/{id}` | — | `200 AssessmentDetail` |
| `PUT /professor/assessments/{id}` | `AssessmentDraft` (full replace) | `200 AssessmentDetail` |
| `DELETE /professor/assessments/{id}` | — | `204` (DRAFT only) |
| `POST /professor/assessments/{id}/publish` | — | `200 AssessmentDetail` |
| `POST /professor/assessments/{id}/remove` | — | `200 AssessmentDetail` (PUBLISHED/CLOSED only) |

```json
// AssessmentDraft
{
  "subjectId": "…",
  "title": "Mid-term: Fundamental Rights",
  "instructions": "Answer all questions. Write legibly …",
  "dueAt": "2026-11-02T18:30:00Z",
  "questions": [
    { "id": null, "text": "Discuss the doctrine of …", "maxMarks": 10, "wordLimit": 500 }
  ]
}
```

**Draft save** (POST/PUT) validates shape only, so a half-written draft can be saved:
- `subjectId` required, and must be mapped to the professor (else `404`)
- `title` required, ≤ 255
- `instructions` ≤ 10,000
- `dueAt` nullable
- `questions` 0–50
- `text` nullable, ≤ 10,000
- `maxMarks` nullable, > 0, ≤ 100, a multiple of 0.5
- `wordLimit` nullable, 1–10,000

Question order is list order. On PUT, existing question ids are kept when sent back; omitted ones are deleted.

**Publish** validates completeness (TDD §6.1). Failures → `400 VALIDATION_ERROR` with one path per problem, e.g. `questions: must contain 1–50 questions`, `questions[2].text: must not be blank`, `questions[4].maxMarks: must be greater than 0`, `dueAt: must be in the future`.

```json
// AssessmentDetail
{
  "id": "…",
  "subject": { "id": "…", "code": "CON-101", "name": "Constitutional Law I" },
  "title": "…",
  "instructions": "…",
  "status": "PUBLISHED",
  "dueAt": "2026-11-02T18:30:00Z",
  "publishedAt": "…", "closedAt": null, "removedAt": null,
  "createdAt": "…", "updatedAt": "…",
  "createdBy": { "id": "…", "fullName": "Dr. K. Menon" },
  "questions": [{ "id": "…", "position": 1, "text": "…", "maxMarks": 10, "wordLimit": 500 }],
  "totalMarks": 50,
  "counts": {
    "students": 120,
    "answerSlots": 600,
    "submitted": 410,
    "pendingEvaluation": 300,
    "aiEvaluated": 60,
    "published": 50,
    "notAttempted": 0
  }
}

// ProfessorAssessmentSummary = AssessmentDetail without instructions and questions, plus "questionCount"
```

| Field | Notes |
|---|---|
| `createdBy` | `null` when the professor was removed (show "Former professor") |
| `counts` | Per answer slot (student × question). `students` = C_STUDENTs in the college. `pendingEvaluation` = submitted answers whose grade is not `PUBLISHED`. `aiEvaluated` = grades in `AI_EVALUATED`. `published` = grades in `PUBLISHED`. `notAttempted` = `answerSlots − submitted` once `CLOSED`, else 0. All grading counts are 0 until Phase 4 |

Errors: `404` (not the caller's, or the subject isn't mapped), `409 ASSESSMENT_NOT_EDITABLE` (PUT/DELETE/publish on non-DRAFT; remove on DRAFT or REMOVED).

### 9.3 Student: assessments

| Method & path | Success |
|---|---|
| `GET /student/assessments?subjectId=&state=&page=&size=` | `200 PagedResponse<StudentAssessmentSummary>` |
| `GET /student/assessments/{id}` | `200 StudentAssessmentDetail` |

Only `PUBLISHED` and `CLOSED` assessments of the student's college are returned. Default order: open ones by `dueAt asc`, then closed ones by `dueAt desc`.

```json
// StudentAssessmentSummary
{
  "id": "…",
  "subject": { "id": "…", "code": "CON-101", "name": "Constitutional Law I" },
  "title": "…",
  "professorName": "Dr. K. Menon",
  "status": "PUBLISHED",
  "state": "PARTIALLY_SUBMITTED",
  "dueAt": "…",
  "questionCount": 5,
  "totalMarks": 50,
  "progress": { "uploaded": 1, "submitted": 2, "resultsPublished": 0 }
}
```

`professorName` is `null` for a removed professor. `state` is derived:

| State | Rule |
|---|---|
| `OPEN` | `PUBLISHED`, `now < dueAt`, 0 submitted |
| `PARTIALLY_SUBMITTED` | `PUBLISHED`, 0 < submitted < questionCount |
| `SUBMITTED` | `PUBLISHED`, submitted = questionCount |
| `CLOSED` | `CLOSED`, no published grade for this student |
| `RESULTS_AVAILABLE` | `CLOSED`, ≥ 1 published grade for this student |

Grades published before closing are visible through `progress.resultsPublished` and the results endpoint (§10.4).

```json
// StudentAssessmentDetail
{
  "id": "…", "subject": { … }, "title": "…", "instructions": "…", "professorName": "…",
  "status": "PUBLISHED", "state": "PARTIALLY_SUBMITTED",
  "dueAt": "2026-11-02T18:30:00Z",
  "serverTime": "2026-10-30T07:12:44Z",
  "totalMarks": 50,
  "uploadLimits": { "maxFileMb": 10, "maxPages": 20 },
  "questions": [
    {
      "id": "…", "position": 1, "text": "…", "maxMarks": 10, "wordLimit": 500,
      "answer": {
        "status": "UPLOADED",
        "originalFilename": "q1.pdf",
        "sizeBytes": 1834221,
        "pageCount": 4,
        "uploadedAt": "…",
        "submittedAt": null
      },
      "resultPublished": false
    }
  ]
}
```

- `answer` is `null` when nothing has been uploaded.
- `serverTime` lets the client correct a skewed device clock for countdowns.
- `uploadLimits` mirrors the storage config (Phase 3 decision).

### 9.4 Student: answers

| Method & path | Body | Success |
|---|---|---|
| `PUT /student/questions/{questionId}/answer` | multipart `file` (PDF) | `200` `answer` object (as in §9.3) |
| `POST /student/questions/{questionId}/answer/submit` | — | `200` `answer` object (`status: SUBMITTED`) |
| `GET /student/questions/{questionId}/answer/file` | — | `200 application/pdf` (own file only) |

Errors:
- Upload: `400 INVALID_FILE`, `409 ANSWER_LOCKED` (already submitted), `409 ASSESSMENT_CLOSED` (`now ≥ dueAt` or not `PUBLISHED`), `404`, `429 RATE_LIMITED`.
- Submit: `400 VALIDATION_ERROR` (`"answer: upload a file before submitting"`), `409 ANSWER_LOCKED`, `409 ASSESSMENT_CLOSED`, `404`.
- File: `404` if nothing has been uploaded.

When an assessment closes, `UPLOADED` answers are deleted (file and row) and count as not attempted.

### 9.5 Professor: submissions grid

`GET /professor/assessments/{id}/answers?questionId=&status=&q=&page=&size=` — paged **by student**, sorted by student name.

| Param | Notes |
|---|---|
| `questionId` | limit `cells` to one question |
| `status` | a `CellStatus` or `GradeStatus`; returns students with ≥ 1 matching cell (within `questionId` if given) |
| `q` | student name or roll no |

```json
{
  "content": [
    {
      "student": { "id": "…", "fullName": "Arjun Rao", "loginId": "21BAL042" },
      "cells": [
        { "questionId": "…", "position": 1, "answerId": "…", "cellStatus": "SUBMITTED",
          "gradeStatus": "PENDING", "finalMarks": null, "submittedAt": "…" },
        { "questionId": "…", "position": 2, "answerId": null, "cellStatus": "UPLOADED",
          "gradeStatus": null, "finalMarks": null, "submittedAt": null }
      ]
    }
  ],
  "page": 0, "size": 50, "totalElements": 120, "totalPages": 3
}
```

`answerId` is set only for `SUBMITTED` answers; professors never see unsubmitted files. `finalMarks` is set only when `PUBLISHED`. `size` max 100.

### 9.6 SUPERADMIN read-only views (A9)

| Method & path | Success |
|---|---|
| `GET /superadmin/colleges/{collegeId}/assessments?subjectId=&status=&page=&size=` | `PagedResponse<ProfessorAssessmentSummary>` |
| `GET /superadmin/assessments/{id}` | `AssessmentDetail` |
| `GET /superadmin/assessments/{id}/answers?…` (ADDED) | same as §9.5 |
| `GET /superadmin/answers/{answerId}` (ADDED) | `AnswerReview` (§10.1) without `navigation` |
| `GET /superadmin/answers/{answerId}/file` (ADDED) | PDF. Does **not** set `professorDownloadedAt` |

---

## 10. Grading & results — PROPOSED (P4)

### 10.1 `GET /professor/answers/{answerId}?order=byStudent|byQuestion`

```json
// AnswerReview
{
  "id": "…",
  "assessment": { "id": "…", "title": "…", "status": "CLOSED" },
  "question": { "id": "…", "position": 2, "text": "…", "maxMarks": 10, "wordLimit": 500 },
  "student": { "id": "…", "fullName": "Arjun Rao", "loginId": "21BAL042" },
  "file": { "originalFilename": "q2.pdf", "sizeBytes": 1834221, "pageCount": 4 },
  "submittedAt": "…",
  "professorDownloadedAt": null,
  "grade": {
    "status": "PENDING",
    "finalMarks": null,
    "finalFeedback": null,
    "gradedBy": null,
    "publishedAt": null,
    "ai": null
  },
  "history": [
    { "event": "DRAFT_SAVED", "marks": 7.5, "feedback": "…",
      "actor": { "id": "…", "fullName": "Dr. K. Menon", "role": "C_PROFESSOR" }, "createdAt": "…" }
  ],
  "navigation": { "previousAnswerId": "…", "nextAnswerId": "…", "nextUngradedAnswerId": "…" }
}
```

| Field | Notes |
|---|---|
| `grade.ai` | `null` until Phase 5 / until evaluated; see §11.2 |
| `history[].event` | `DRAFT_SAVED`, `AI_EVALUATED`, `AI_FAILED`, `PUBLISHED` |
| `navigation` | Within the same assessment, over submitted answers in the requested `order` (default `byStudent`: student name, then question position). `null` at either end |

Errors: `404` (not the caller's assessment, answer not submitted, or professor removed).

### 10.2 `GET /professor/answers/{answerId}/file`
Streams the PDF. The **first** successful call sets `professorDownloadedAt` (this enables AI Evaluate).

### 10.3 Grade actions

| Method & path | Body | Success |
|---|---|---|
| `PUT /professor/answers/{answerId}/grade` | `{ "finalMarks": 7.5, "finalFeedback": "…" }` (both nullable) | `200` `grade` object |
| `POST /professor/answers/{answerId}/approve` | optional `{ "finalMarks", "finalFeedback" }` (saved first, atomically) | `200` `grade` object (`status: PUBLISHED`) |

Rules:
- `finalMarks`: 0 ≤ marks ≤ `maxMarks`, a multiple of 0.5 → else `400 INVALID_MARKS`.
- `finalFeedback`: ≤ 10,000 chars. **Approve** requires both `finalMarks` and a non-blank `finalFeedback` (`400 VALIDATION_ERROR` naming the missing field).
- Saving a draft doesn't change `status`. Approve sets `PUBLISHED`, `publishedAt` and `gradedBy`, writes `grade_history`, and invalidates the ranking cache.
- Both actions on a `PUBLISHED` grade → `409 GRADE_PUBLISHED`.
- Approve is allowed while `AI_EVALUATING`. A late AI result is then written to history only.

### 10.4 `GET /student/assessments/{id}/results`

```json
{
  "assessment": { "id": "…", "title": "…", "subject": { … }, "status": "CLOSED", "dueAt": "…" },
  "totals": { "publishedMarks": 31.5, "publishedMaxMarks": 40, "totalMaxMarks": 50 },
  "questions": [
    { "questionId": "…", "position": 1, "text": "…", "maxMarks": 10,
      "outcome": "PUBLISHED", "finalMarks": 8, "finalFeedback": "…", "publishedAt": "…" },
    { "questionId": "…", "position": 2, "text": "…", "maxMarks": 10,
      "outcome": "AWAITING_EVALUATION", "finalMarks": null, "finalFeedback": null, "publishedAt": null },
    { "questionId": "…", "position": 3, "text": "…", "maxMarks": 10,
      "outcome": "NOT_ATTEMPTED", "finalMarks": 0, "finalFeedback": null, "publishedAt": null }
  ]
}
```

- `outcome` is one of: `PUBLISHED`, `AWAITING_EVALUATION` (submitted, grade not published), `NOT_ATTEMPTED` (closed without a submission), `NOT_SUBMITTED` (still open, not submitted).
- **Never** returns AI fields or draft marks/feedback (§7.8).
- `REMOVED` assessments → `404` (A2).

---

## 11. AI evaluation — PROPOSED (P5)

### 11.1 `POST /professor/answers/{answerId}/ai-evaluate`
No body. `202 Accepted`:
```json
{ "answerId": "…", "gradeStatus": "AI_EVALUATING", "jobId": "…" }
```

Errors:
- `409 AI_EVALUATION_NOT_ALLOWED`, whose `message` says why: `"Download the answer PDF before using AI evaluation"`, `"This grade is already published"` or `"An AI evaluation is already running"`.
- `404`, `429 RATE_LIMITED`.

Re-evaluating an `AI_EVALUATED` or `AI_FAILED` grade is allowed. It overwrites `grade.ai` and appends to history.

**Polling:** clients poll `GET /professor/answers/{id}` (§10.1) until `grade.status` leaves `AI_EVALUATING`, every 3 s, backing off to 10 s.

### 11.2 `grade.ai` object
```json
{
  "marks": 6.5,
  "feedback": "Identifies the issue correctly but misses Maneka Gandhi …",
  "estimatedWords": 540,
  "flags": ["WORD_LIMIT_EXCEEDED", "LOW_CONFIDENCE"],
  "evaluatedAt": "…",
  "error": null
}
```

| Field | Notes |
|---|---|
| `marks` | Server-rounded **down** to 0.5 and clamped to 0..max |
| `flags` | Any of `WORD_LIMIT_EXCEEDED`, `ILLEGIBLE`, `OFF_TOPIC`, `BLANK`, `LOW_CONFIDENCE` |
| `error` | When `AI_FAILED`: a short safe message (`"The evaluation service did not return a valid result"`); the other fields are `null` |

Only professors (and SUPERADMIN read-only) ever receive this object.

### 11.3 `GET /superadmin/ai-usage?collegeId=&from=&to=` — ADDED (P5.8)
```json
[{ "college": { "id": "…", "code": "NLSIU", "name": "…" },
   "kind": "COLLEGE_EVALUATION", "jobs": 640, "succeeded": 631, "failed": 9,
   "inputTokens": 5120000, "outputTokens": 410000,
   "estimatedCost": { "amount": 38.42, "currency": "USD" } }]
```
`college` is `null` for solo kinds (`SOLO_EVALUATION`, `SOLO_QUESTION`, `SOLO_ANSWER`).

---

## 12. Rankings & statistics — PROPOSED (P6)

Every response here carries `generatedAt` (results are cached for up to 5 minutes).

### 12.1 `GET /analytics/subjects/{subjectId}/ranking`
Roles: C_ADMIN (subjects of their college), C_PROFESSOR (mapped subjects), SUPERADMIN (any). Out of scope → `404`. Students → `403`.

```json
{
  "subject": { "id": "…", "code": "CON-101", "name": "Constitutional Law I" },
  "college": { "id": "…", "code": "NLSIU", "name": "…" },
  "maxTotal": 150,
  "assessmentCount": 3,
  "generatedAt": "…",
  "rows": [
    { "rank": 1, "student": { "id": "…", "fullName": "Arjun Rao", "loginId": "21BAL042" },
      "obtained": 128.5, "scorePct": 85.67, "questionsAttempted": 14, "gradesPublished": 14 },
    { "rank": 1, "student": { … }, "obtained": 128.5, "scorePct": 85.67, … },
    { "rank": 3, "student": { … }, … }
  ]
}
```

- Every C_STUDENT of the college appears, including those at 0.
- `rank` is `RANK()` over `scorePct desc` (1, 1, 3); ties are ordered by `fullName`.
- `maxTotal` = sum of `maxMarks` over the subject's `PUBLISHED` and `CLOSED` assessments. When it is 0, every `scorePct` is 0 and every rank is 1.
- The response is not paged (≤ 2,000 rows).

### 12.2 `GET /analytics/overview?collegeId=`
Roles: C_ADMIN (own college; `collegeId` ignored) and SUPERADMIN (`collegeId` required).
```json
{
  "college": { … },
  "generatedAt": "…",
  "subjects": [
    {
      "subject": { "id": "…", "code": "CON-101", "name": "…" },
      "students": 120,
      "assessments": { "published": 1, "closed": 2, "removed": 0 },
      "questions": 15,
      "answersSubmitted": 1610,
      "pendingEvaluation": 140,
      "gradesPublished": 1470,
      "averageScorePct": 62.4
    }
  ]
}
```

### 12.3 `GET /analytics/students/{studentId}`
Roles: C_ADMIN (own college) and SUPERADMIN.
```json
{
  "student": { "id": "…", "fullName": "…", "loginId": "…" },
  "generatedAt": "…",
  "subjects": [
    { "subject": { … }, "scorePct": 71.25, "rank": 12, "rankedOutOf": 120,
      "questionsAttempted": 13, "questionsPublished": 15, "pendingEvaluations": 1 }
  ]
}
```

---

## 13. Solo practice — PROPOSED (P7)

Role: `S_STUDENT`. Every endpoint except `GET /solo/usage` and `GET /solo/subjects` needs an `ACTIVE` plan, else `402 PLAN_REQUIRED`.

### 13.1 Async model
AI work runs as `ai_jobs`. Generate and evaluate calls return `202` with a resource in a pending status, and clients poll that resource's GET until it reaches a terminal status. This needs a `status` column on `solo_questions` and `solo_answer_generations` (ADDED to TDD §5.4).

| Resource | Pending | Terminal |
|---|---|---|
| Question | `GENERATING` | `READY`, `FAILED` |
| Attempt | `UPLOADED` → `EVALUATING` | `EVALUATED`, `FAILED` |
| Generated answer | `GENERATING` | `READY`, `FAILED` |

A `FAILED` generation gives its quota unit back (open item O3).

### 13.2 `GET /solo/usage`
Works without a plan, because the client needs it for the plan gate.
```json
{
  "plan": { "status": "ACTIVE", "periodStart": "2026-10-01", "periodEnd": "2026-12-31", "source": "MANUAL" },
  "period": "2026-10",
  "generationsUsed": 12,
  "generationsLimit": 60,
  "resetsAt": "2026-10-31T18:30:00Z",
  "maxAttemptsPerQuestion": 3,
  "retentionDays": 30
}
```

`plan.status` is `ACTIVE` \| `EXPIRED` \| `NONE`. With `NONE`, the other `plan` fields are `null`.

### 13.3 `GET /solo/subjects`
`200 [{ "id", "name" }]`, active subjects only, sorted by name.

### 13.4 Questions

| Method & path | Body | Success |
|---|---|---|
| `POST /solo/questions` | `{ "subjectId", "difficulty", "wordLimit", "maxMarks" }` | `202 SoloQuestion` (`status: GENERATING`) |
| `GET /solo/questions?subjectId=&page=&size=` | — | `200 PagedResponse<SoloQuestionSummary>` (last 30 days, newest first) |
| `GET /solo/questions/{id}` | — | `200 SoloQuestion` |

| Field | Rules |
|---|---|
| `difficulty` | `EASY` \| `MEDIUM` \| `HARD` |
| `wordLimit` | 50–2000 |
| `maxMarks` | one of 5, 10, 15, 20, 25 |

```json
// SoloQuestion
{
  "id": "…",
  "subject": { "id": "…", "name": "Law of Contracts" },
  "difficulty": "MEDIUM",
  "wordLimit": 400,
  "maxMarks": 10,
  "status": "READY",
  "questionText": "A, a minor, enters into …",
  "error": null,
  "createdAt": "…",
  "expiresAt": "…",
  "attemptsUsed": 1,
  "attemptsRemaining": 2,
  "attempts": [ /* SoloAttempt, newest first */ ]
}
// SoloQuestionSummary = SoloQuestion without attempts, with questionText truncated to 200 chars and "bestMarks"
```

Errors: `402 PLAN_REQUIRED`, `429 QUOTA_EXCEEDED` (the message includes the reset date), `429 RATE_LIMITED`, `400 VALIDATION_ERROR`, `404` (expired or not owned).

### 13.5 Attempts

| Method & path | Body | Success |
|---|---|---|
| `POST /solo/questions/{id}/attempts` | multipart `file` (PDF) | `202 SoloAttempt` (`status: EVALUATING`) |
| `POST /solo/questions/{id}/attempts/{attemptId}/retry` (ADDED) | — | `202 SoloAttempt` (FAILED attempts only) |
| `GET /solo/questions/{id}/attempts/{attemptId}/file` (ADDED) | — | PDF |

```json
// SoloAttempt
{ "id": "…", "attemptNo": 1, "status": "EVALUATED",
  "marks": 6.5, "feedback": "…", "flags": ["WORD_LIMIT_EXCEEDED"], "estimatedWords": 470,
  "error": null, "createdAt": "…", "evaluatedAt": "…" }
```

- `attemptNo` runs 1–3 and counts only evaluated attempts; a failed run can be retried without using one up.
- Poll `GET /solo/questions/{id}`.
- Errors: `409 ATTEMPT_LIMIT_REACHED`, `409 AI_EVALUATION_NOT_ALLOWED` if another attempt is `EVALUATING` (`"Wait for the current evaluation to finish"`), `400 INVALID_FILE`, `402`, `404`, `429 RATE_LIMITED`.
- Attempts don't use quota.

### 13.6 Generated answers

| Method & path | Body | Success |
|---|---|---|
| `POST /solo/answers` | `{ "questionText": "…" }` (10–4,000 chars) | `202 SoloAnswer` (`status: GENERATING`) |
| `GET /solo/answers?page=&size=` | — | `200 PagedResponse<SoloAnswer>` (last 30 days) |
| `GET /solo/answers/{id}` (ADDED, for polling) | — | `200 SoloAnswer` |

```json
// SoloAnswer
{ "id": "…", "questionText": "…", "status": "READY", "answerText": "…", "error": null,
  "createdAt": "…", "expiresAt": "…" }
```

`answerText` is plain text with paragraphs separated by blank lines. No HTML. It uses 1 generation.

### 13.7 SUPERADMIN: solo subjects & plans

| Method & path | Body | Success |
|---|---|---|
| `GET /superadmin/solo-subjects` | — | `200 [{ id, name, active, questionCount }]` |
| `POST /superadmin/solo-subjects` | `{ "name" }` | `201` |
| `PUT /superadmin/solo-subjects/{id}` | `{ "name", "active" }` | `200` |
| `DELETE /superadmin/solo-subjects/{id}` | — | `204`, or `409 SUBJECT_IN_USE` if questions reference it (deactivate instead) |
| `GET /superadmin/solo-plans?q=&status=&page=&size=` (ADDED) | — | `200 PagedResponse<{ user: UserSummary, plan, period, generationsUsed }>` |
| `PUT /superadmin/solo-plans/{userId}` | `{ "periodStart": "2026-10-01", "periodEnd": "2026-12-31" }` | `200` plan |

`PUT` with `periodEnd` in the past expires the plan. The user must be an `S_STUDENT`, else `404`.

---

## 14. Payments — P8 (to be designed)

Placeholder. Designed in the Phase 8 payment addendum. The client contract will be: list plans → create checkout → hosted gateway widget → poll `GET /solo/usage` until `plan.status` becomes `ACTIVE` (the webhook is the source of truth, never the client callback).

---

## 15. Removed endpoints

| Endpoint | Removed by |
|---|---|
| `/practice/**` (question banks, attempts, responses, submit, result) | Phase 0 (TDD §3.1) |
| `/admin/practice/**` | Phase 0 |
| `/subscriptions/**` (plans, me, checkout, verify, cancel, webhook) | V13 (done) |
| `PUT /admin/caselaws/{id}/free-flag`, `PUT /admin/sections/{id}/free-flag` | V13 (done) |
| `/admin/caselaws/{id}/summary` | V11 (done) |
| `/users/me/practice-stats`, `/users/me/bare-act-progress`, `/users/me/continue-learning`, `/users/me/learning-activity`, `/users/me/sections/{id}/progress`, `GET /search` (old Home contract) | Not in TDD v2. Never built; the frontend flags stay off |

The `isFree` field and the `PRO_REQUIRED` error no longer exist anywhere.

---

## 16. Open items

| # | Item | Proposed default |
|---|---|---|
| O1 | Initial C_ADMIN password: SUPERADMIN-typed temporary password vs. a server-generated one shown once | Typed temporary password (§6.2) |
| O2 | `COLLEGE_INACTIVE` after a correct password vs. a generic 401 | Explicit 403 after a correct password (more helpful, no enumeration) |
| O3 | Refund the quota for a `FAILED` solo generation | Yes |
| O4 | Upload limits (`maxFileMb`, `maxPages`) | Phase 3 decision; the example values above are placeholders |
| O5 | Professor removed mid-grading: should SUPERADMIN/C_ADMIN be able to reassign? (A1) | Not in v1 |
| O6 | Page `size` max | 100 everywhere (grids included) |
| O7 | Should student results include the AI's word estimate (it's useful feedback on the word limit)? | No: §7.8 forbids every AI field for students |

---

## Changelog

| Date | Change |
|---|---|
| 2026-10-13 | First version. LIVE sections documented from `feature/epic1`; P0–P7 proposed from TDD v2 |
