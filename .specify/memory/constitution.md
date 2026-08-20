# ALMA Constitution

<!-- ALMA: Cognitive Operating System — Self-Hosted, Sovereign, Persistent -->

## Core Principles

### I. Data Sovereignty (NON-NEGOTIABLE)

All user data MUST reside in self-hosted infrastructure. No sensitive data may be sent
to or stored in third-party SaaS platforms. Every service MUST be containerized and
runnable locally via `docker-compose`. Cloud providers may only be used for LLM inference
(stateless), never for persistent storage. Any exception requires explicit user approval
and must be documented in the relevant spec.

### II. Transparent Memory (Obsidian-First)

Memory is never a black box. All persistent knowledge MUST be stored as human-readable
Markdown files with YAML Frontmatter (compatible with Obsidian). Relationships between
concepts MUST use `[[WikiLinks]]` syntax. If a human edits a Markdown file, ALMA MUST
be capable of re-ingesting and re-indexing it. Vectorized representations in `pgvector`
are a derivative of the Markdown source — the Markdown is the source of truth.

### III. Non-Blocking Persistence (Fire & Forget)

Saving memory or logs MUST NEVER block the user-facing response. Every write to
persistent storage (short-term memory, logs, embeddings) MUST be executed asynchronously
via background workers or middleware. The orchestrator response loop MUST complete
independently of any persistence operation. Failures in persistence MUST be logged
silently and MUST NOT propagate as user-facing errors.

### IV. Strict TypeScript (NON-NEGOTIABLE)

All code MUST be written in TypeScript with `strict: true`. The use of `any` is
prohibited. Every function, method, and exported symbol MUST have explicit type
annotations. Prisma-generated types are the canonical data types for all DB entities —
do not redeclare or shadow them. Shared types MUST live in `packages/shared`.

### V. PostgreSQL as Single Source of Truth

PostgreSQL is the only persistence backend. No other databases, file-based stores, or
in-memory caches may be used as primary storage. Prisma ORM is the mandatory query
interface — raw SQL is only permitted for performance-critical operations and MUST be
documented. The `pgvector` extension MUST be used for all semantic/vector operations.
`pg-boss` MUST be used for all scheduled and deferred job processing (CHRONOS, ONIROS).

### VI. Containerization-First

Every service MUST have a `Dockerfile` and MUST be declared in the root
`docker-compose.yml`. Services MUST communicate via Docker network aliases, never via
`localhost`. Environment variables MUST be declared in `.env.example` alongside their
defaults. No service may depend on a globally installed tool — all dependencies MUST
be resolvable from within the container.

## Stack Constraints

- **Runtime**: Node.js 20+ LTS, TypeScript 5+
- **Package Manager**: pnpm (workspaces enabled)
- **ORM**: Prisma (schema in `services/mcp-server/prisma/schema.prisma`)
- **DB Extensions**: `pgvector` (semantic search), `pg-boss` (job queue)
- **LLM Providers**: Gemini Flash (routing/speed), larger models for complex reasoning.
  Provider abstraction MUST be maintained via `ILlmProvider` interface.
- **Frontend (upcoming)**: Next.js (App Router) + Tailwind CSS + Shadcn/ui, Mobile-First PWA
- **Infrastructure**: Docker + docker-compose. No Kubernetes until scale requires it.

## Development Workflow

All features MUST follow the Spec-Driven Development (SDD) cycle:

1. **Constitution** — Validate that the feature aligns with these principles before starting.
2. **Clarify** — Reduce ambiguity. Ask targeted questions before writing specs.
3. **Specify** — Write the feature spec using `.specify/templates/spec-template.md`.
4. **Plan** — Break the spec into an implementation plan with ordered phases.
5. **Tasks** — Generate atomic, independently testable tasks.
6. **Implement** — Code only what the tasks describe. No scope creep.

Features that skip steps 2–4 MUST be flagged as technical debt and retroactively documented.

Each of the 4 biological agents of ALMA (LOGOS, MNEMOS, CHRONOS, ONIROS) is treated as
a separate feature domain. Cross-domain changes MUST be coordinated via a shared spec.

## Governance

- This constitution supersedes all other practices and informal agreements.
- Amendments require: a written rationale, version bump per semantic versioning rules,
  and an update to all dependent templates under `.specify/templates/`.
- All PRs MUST include a "Constitution Check" confirming no principles were violated.
- Complexity MUST be justified. YAGNI (You Aren't Gonna Need It) applies unless the
  spec explicitly requires a capability.
- The `ALMA.MD` file is the canonical vision document. This constitution is derived from
  it. If they conflict, `ALMA.MD` takes precedence and this constitution MUST be amended.

**Version**: 1.0.0 | **Ratified**: 2026-03-11 | **Last Amended**: 2026-03-11
