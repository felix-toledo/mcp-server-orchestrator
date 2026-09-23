# Plan — Skills as a managed entity

Base: [`spec.md`](./spec.md). Same CRUD shape as `AgentService`/`agentsController`
(`orchestrator/002-multi-agent` T1) — this plan mostly points at that
implementation as the pattern to mirror rather than re-deriving it.

## 1. `knowledge-store`

`SkillService` (`src/services/skillService.ts`) + `skillsController.ts` +
`SkillInputSchema` in `schemas.ts` — identical shape to `AgentService`, no
null-vs-`[]` nuance to handle (spec §5.1: all three fields are plain
required strings).

```typescript
export interface SkillInput {
  name: string;
  description: string;
  instructions: string;
}

export class SkillService {
  constructor(private readonly prisma: PrismaClient, private readonly userService: UserService) {}
  create(input: SkillInput): Promise<Skill>;
  list(): Promise<Skill[]>;
  getById(id: string): Promise<Skill | null>;
  update(id: string, input: SkillInput): Promise<Skill>;
  delete(id: string): Promise<void>;
}
```

## 2. Migration (AC4)

A one-off script (`services/knowledge-store/scripts/migrateFsSkills.ts`, run
manually via `tsx`/`ts-node`, not part of the normal request path): reads
every `*.md` in `services/orchestrator/skills/` (if the folder exists at
all — it doesn't today), derives `name` from the filename, `instructions`
from the file body, and `description` from... nothing reliable exists in
the current filesystem format (no frontmatter). Since the folder is
actually empty at spec time (confirmed), the script's `description`
fallback (first non-empty line of the file, truncated) is a best-effort
default for a hypothetical future file, not a real migration this round —
noted so nobody is surprised the description reads oddly if this script
ever runs against a real legacy file.

## 3. `orchestrator` — `SkillManager`/`SkillRouter` (AC3)

`SkillManager`'s constructor changes from "read the filesystem" to "take an
array":

```typescript
export interface SkillSummary {
  name: string;
  description: string;
  instructions: string;
}

export class SkillManager {
  constructor(private readonly skills: SkillSummary[]) {}
  resolve(names: string[]): string { /* same join-instructions logic as today */ }
  list(): SkillSummary[] { /* was string[] — now carries description too, for the router */ }
}
```

The module-level `export const skillManager = new SkillManager()` singleton
is removed. `graphRuntime.ts` builds one per request from
`knowledgeStoreClient.listSkills()` (fail-open to `[]`), same lifecycle as
`AgentRegistry`'s `Agent[]` fetch.

`SkillRouter.route`'s second parameter becomes
`Array<{ name: string; description: string }>` instead of `string[]` —
`buildPrompt` lists `"name: description"` pairs instead of bare names, so
the router (AC2) actually has something to match against.

**Call sites to update**: `buildReasoningGraph.ts`'s
`createRunSkillRouterNode({ ..., availableSkills: deps.availableSkills ?? deps.skillManager.list() })`
now passes `SkillSummary[]` through; `createCallLlmNode`'s
`skillManager.resolve(state.skillsToUse)` is unaffected (still takes
names). `AgentRegistry.getOrBuildGraph`'s own `availableSkills` computation
(`agent.allowedSkills ?? this.baseGraphDeps.skillManager.list()`) still
works since `list()`'s return type just gained a field.

## 4. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `SkillService` (mocked `PrismaClient`) | AC1 CRUD |
| `skillsController` (supertest) | one test per endpoint/status |
| `SkillManager` | `resolve`/`list` against an injected array, no filesystem |
| `SkillRouter` | prompt building includes descriptions, not just names |

## 5. Build order (→ `tasks.md`)

1. `knowledge-store`: `Skill` schema + `SkillService` + controller/routes +
   tests.
2. Migration script (AC4) — exists and is tested against a fixture folder,
   even though nothing real needs migrating yet.
3. `orchestrator`: `SkillManager` constructor change + `SkillSummary` type
   + tests.
4. `SkillRouter.route`'s signature change + tests.
5. `graphRuntime.ts`: fetch `Skill[]` per request, build `SkillManager`
   from it, remove the filesystem-reading singleton and the now-unused
   `skills/` folder lookup.
6. Manual end-to-end: create a real Skill via the HTTP API, confirm a chat
   message matching its `description` gets it selected by the router and
   its `instructions` show up in the system prompt's effect on the reply.
