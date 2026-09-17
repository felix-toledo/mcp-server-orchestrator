# Frontend Conventions (Next.js)

Not scaffolded yet (see the roadmap in [`../../CLAUDE.md`](../../CLAUDE.md)) —
this is the target layout to use when it is, so the decision is made once,
before there's code to migrate. Based on the App Router's own conventions
([Next.js project structure docs](https://nextjs.org/docs/app/getting-started/project-structure))
plus this repo's existing layering rules.

## Directory layout

```
services/frontend/
├── src/
│   ├── app/                # routes ONLY: page.tsx, layout.tsx, loading.tsx,
│   │                       # error.tsx, route.ts — no business logic here
│   ├── actions/            # Server Actions ("use server"), one action per file
│   ├── components/
│   │   ├── ui/             # generic, no domain knowledge (Button, Card, Input)
│   │   └── <feature>/      # domain components (ProjectCard, ProjectFilters)
│   ├── lib/                # framework-agnostic clients & helpers (API client,
│   │                       # formatting, the orchestrator HTTP client)
│   ├── hooks/               # custom hooks, `use` prefix
│   ├── types/               # shared TypeScript types
│   └── config/              # env parsing, constants
└── public/
```

## Rules

- **`app/` holds routes, nothing else.** A page-specific component that isn't
  reused anywhere else can be colocated next to its `page.tsx` in the same
  route folder instead of `components/` — but a component used by two or more
  routes belongs in `components/`, not duplicated.
- **Server Components by default.** Add `"use client"` only to the specific
  leaf component that needs interactivity/browser APIs — never at the top of
  a whole page just to make one child interactive.
- **Server Actions live in `actions/`, one file per action** (or a small
  cohesive group), not inline inside a component file, so they're easy to
  find, test, and reuse from more than one form.
- **`lib/` is framework-agnostic.** Nothing in `lib/` imports from `next/*` or
  React — it should be portable to a Node script or a test with zero
  Next.js-specific setup. The HTTP client that calls the orchestrator's
  `/api/inquire` belongs here, not inside a component.
- **No UI logic in `lib/`, no data-fetching logic in `components/ui/`.**
  Mixing UI with business/data logic is exactly the mistake this layout
  exists to prevent.
- **Naming**: see [`naming.md`](./naming.md) — `PascalCase.tsx` for
  components, `camelCase.ts` with a `use` prefix for hooks, `kebab-case.ts`
  for everything else in `lib/`/`actions/`.
- **Comments**: same rule as the rest of the repo — see
  [`architecture.md`](./architecture.md#comments). Self-explanatory component
  and prop names beat a comment explaining what a component renders.

## Testing

Vitest (see the root [`CLAUDE.md`](../../CLAUDE.md) testing section for why
Vitest and not Jest). Test files sit next to the file they test
(`ProjectCard.test.tsx` next to `ProjectCard.tsx`) or under `actions/` mirrored
by name — not in a separate parallel `__tests__` tree.

**Component-render tests (jsdom/testing-library) aren't required** — the
ALMA PoC covers its Acceptance Criteria by testing `lib/` (mocked `fetch`)
and `actions/` (mocked `lib/` clients) with Vitest, and the actual rendered
UI with Playwright e2e instead (below). Add jsdom + `@testing-library/react`
only if a component grows real conditional rendering logic that neither
layer would catch.

### E2E (Playwright, `services/frontend/e2e/`)

Real Chromium against the real Next.js app, with `knowledge-store` and
`orchestrator` replaced by one mock (`e2e/mock-backend.js`, a small stateful
Express app) — deterministic, no live Postgres/OpenAI/DeepSeek needed, and
still a genuine test of the actual rendered UI (unlike the Vitest layer,
which never touches a browser). `playwright.config.ts` starts both the mock
and the frontend (`dev:e2e`, port `30099`) automatically.

- **`workers: 1` is load-bearing, not a default left in place.** Every spec
  shares the one mock backend's in-memory state; running spec files in
  parallel workers raced on it and produced real, reproducible flakiness
  (confirmed directly — tests passed reliably once forced serial). Don't
  raise it without giving the mock per-worker isolation first.
- **`next.config.ts`'s `distDir` switches to `.next-e2e` under
  `PLAYWRIGHT_E2E`** (set by `playwright.config.ts`) — `next dev` on a
  different port still shares the same `.next` build output by default, so
  running the e2e server (`dev:e2e`, 30099) and the regular dev server
  (`dev`, 30022) at the same time would otherwise corrupt both (confirmed:
  produces the `Cannot find module './NNN.js'` /
  `__webpack_modules__[moduleId] is not a function` class of runtime error —
  see the root `CLAUDE.md` note on never running `build`/`build:frontend`
  while `dev:frontend` is live, same underlying cause).
- Each spec resets the mock via `e2e/reset-backend.ts`'s `resetBackend()` in
  `test.beforeEach` — never assume a clean slate otherwise.
- Run with `pnpm --filter @mcp-server-sma/frontend run test:e2e` (needs
  `npx playwright install chromium` once per machine).

## Talking to the backend

For chat, the frontend is a client of the orchestrator's `/api/inquire`
endpoint like any other channel — it never calls `mcp-server` directly, and
it never talks to Prisma or the filesystem itself for that path.

For anything that isn't a conversation turn (onboarding, browsing/editing
the knowledge vault), the frontend calls the `knowledge-store` service's own
HTTP API directly, server-side (from a Server Action or Route Handler, never
from a Client Component) — see
[ADR-0001](../adr/0001-knowledge-store-as-separate-service.md) for why this
is a deliberate exception to "always through the orchestrator," not a hole
in the rule.
