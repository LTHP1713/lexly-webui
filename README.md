# lexly-webui

React web frontend for Lexly, talking to the Spring Boot backend at
`http://localhost:8080/api/v1` (configurable via `VITE_API_BASE_URL`).

## Stack

- Vite + React + TypeScript
- React Router
- Plain CSS Modules for styling (no UI kit) — see the comment at the top of
  [`src/pages/auth/LoginPage.tsx`](src/pages/auth/LoginPage.tsx)
- A small typed API client (`src/api/client.ts`) wrapping `fetch`

## Getting started

```bash
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if your backend runs elsewhere
npm run dev             # http://localhost:5173
```

`npm run build` type-checks (`tsc -b`) and builds; `npm run lint` runs oxlint.

## Progress

See [docs/progress/frontend_progress.md](docs/progress/frontend_progress.md).
