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

## Talking to the backend

The frontend is a client of the orchestrator's `/api/inquire` endpoint like
any other channel (see [`../context.md`](../context.md) for how channels
identify themselves) — it never calls `mcp-server` directly, and it never
talks to Prisma/the database directly. All data access goes through the
orchestrator.
