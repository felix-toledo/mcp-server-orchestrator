# Naming Conventions

Applies to every workspace (`services/*`, `packages/*`). Enforced by
`eslint.config.mjs` where ESLint can check it mechanically; everything else is
enforced by `quality-checker` in review.

## Language

**Everything in this repo is English**: code, identifiers, comments, docs,
commit messages, agent/skill instructions, file and folder names. The one
deliberate exception is user-facing content in the Public Works domain (LLM
prompts, chatbot replies, any data mirroring real government paperwork) — see
[`../context.md`](../context.md#naming-convention-for-this-domain) for why.

## Code identifiers

| Kind                                   | Convention              | Example                          |
| --------------------------------------- | ------------------------ | --------------------------------- |
| Variable, function, method parameter    | `camelCase`              | `projectId`, `getProjectDetail()` |
| Boolean variable                        | `camelCase` + `is`/`has`/`should` prefix | `isActive`, `hasPermission` |
| Constant (module-level, never reassigned) | `UPPER_CASE`            | `MAX_ITERATIONS`, `SESSION_TTL_MS` |
| Class, interface, type alias, enum      | `PascalCase`              | `LlmProviderFactory`, `ILlmProvider` (see note) |
| Enum member                             | `UPPER_CASE`              | `GovernmentPillar.DEVELOPMENT`    |
| React component (frontend, once it exists) | `PascalCase`           | `ProjectCard`                     |
| React hook (frontend)                   | `camelCase` + `use` prefix | `useProjectFilters`             |
| Generic type parameter                  | single uppercase letter, or `PascalCase` if it needs a descriptive name | `T`, `TResponse` |

**Zod schema constants**: `PascalCase` ending in `Schema` (`HelloWorldInputSchema`),
matching the `PascalCase` type it's usually paired with via `z.infer`
(`HelloWorldInput`). This is a deliberate exception to plain variable casing,
encoded in `eslint.config.mjs`.

**Interface prefix**: keep the existing `I` prefix already in use in this repo
(`ILlmProvider`) for consistency with what's already written — don't add it to
new plain types/interfaces that don't already follow that pattern, and don't
mass-rename the existing ones. Modern tooling makes the prefix unnecessary,
but a partial rename is worse than either extreme.

**No Hungarian notation, no type suffixes** (`projectList`, not
`projectArr`). Let TypeScript's type system carry the type; the name should
carry the meaning.

**Abbreviations**: avoid them unless the abbreviation is more recognizable
than the full word in this codebase (`id`, `url`, `db` are fine; `usr`,
`proj`, `cfg` are not). Treat acronyms as whole words: `loadHttpUrl`, not
`loadHTTPURL`.

## Files and folders

| Kind                                     | Convention   | Example                        |
| ------------------------------------------ | ------------ | -------------------------------- |
| Regular source file (service, util, tool)  | `kebab-case` or `camelCase`, matching the file's default export name | `project-service.ts` or `projectService.ts` — pick one per workspace and stay consistent within it |
| React component file (frontend)            | `PascalCase.tsx`, matching the component | `ProjectCard.tsx`               |
| React hook file (frontend)                 | `camelCase.ts`, matching the hook       | `useProjectFilters.ts`          |
| Next.js route-convention files             | exactly as Next.js requires — don't rename these | `page.tsx`, `layout.tsx`, `route.ts` |
| Test file                                  | same name as the file under test + `.test.ts`(x) | `project-service.test.ts`     |
| Folder                                     | `kebab-case`                            | `infraestructure/tools/`, `conventions/` |

Existing files that predate this convention (e.g. some `PascalCase.ts` service
files in `services/orchestrator/src`) don't need a rename just to comply —
rename opportunistically when you're already touching that file for another
reason, not as a standalone churn PR.

## Database / schema (Prisma)

Not yet in effect (schema is empty) — applies from the first real model:

- Model names: `PascalCase`, singular (`Project`, not `Projects`).
- Field names: `camelCase` (`financialProgress`, not `financial_progress`).
- Enum names: `PascalCase`; enum members `UPPER_CASE`.
- See [`../context.md`](../context.md) for the actual English names decided
  for this domain's entities.

## MCP tool names

Tool names exposed over the MCP protocol (the string an LLM calls) are
`camelCase` verbs-first, matching the existing `helloWorldTool` example
pattern: `listProjects`, `getProjectDetail`, not `projectsList` or
`project_detail`.
