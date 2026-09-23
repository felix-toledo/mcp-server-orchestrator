# Spec — Skills as a managed entity

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §7) |
| **Group** | backend (new `knowledge-store` model + endpoints; `orchestrator`'s `SkillManager`/`SkillRouter` switch to reading from here) |
| **Depends on** | none new |
| **Depended on by** | [`orchestrator/003-teams`](../../orchestrator/003-teams/spec.md) (a Team's own skills reference this), `frontend/004-chat-shell` AC9 (Agentes y Skills tab gains Skill CRUD) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

Today a "skill" is a `.md` file `orchestrator`'s `SkillManager` reads from
its own `skills/` folder at startup — no metadata beyond a filename, no way
to add one without editing the filesystem, and the **Agentes y Skills**
Settings tab (`frontend/004-chat-shell` AC9) only actually lets you manage
`Agent`s despite its name. This spec makes `Skill` a real, user-manageable
entity — same CRUD shape as `Agent` — so both individual `Agent`s and
`orchestrator/003-teams`' `Team`s can reference real Skills instead of raw
filenames, and the Settings tab can finally let you add one from the UI.

## 2. User Story & Acceptance Criteria

**As the user**, I create named Skills (a description + a body of
instructions) from Settings, and any `Agent` or `Team` can be given access
to a combination of them — the same skill can be reused by however many
agents/teams need it, without copy-pasting instructions.

- **AC1**: `Skill` CRUD — `{ id, name, description, instructions }`. All
  three fields are required (unlike `Agent`'s optional restriction lists,
  a Skill with no `description` can never be automatically routed to, and
  one with no `instructions` does nothing — both are meaningless empty).
- **AC2**: `description` is what `SkillRouter` (`orchestrator/001-reasoning-pipeline`
  §6.2) matches a user's message against to decide whether a Skill applies
  — not just the `name` as today. `instructions` is what actually gets
  injected into the system prompt once a Skill is selected (same role the
  `.md` file's body plays today).
- **AC3**: `orchestrator`'s `SkillManager` and `SkillRouter` read Skills
  from `knowledge-store` (fetched fresh per request, same pattern
  `AgentRegistry` already uses for `Agent` — see
  [`orchestrator/002-multi-agent`](../../orchestrator/002-multi-agent/spec.md)
  §3) instead of the filesystem. The `skills/` folder and its `.md` files
  are retired once this ships.
- **AC4**: A **one-time migration** imports whatever `.md` files exist in
  `services/orchestrator/skills/` into real `Skill` rows before the
  filesystem path is removed — confirmed 2026-09-17, so nothing already
  written is lost. (At spec time, that folder is actually empty — the
  migration path still needs to exist for correctness/future safety, even
  though there is nothing to migrate today.)
- **AC5**: `Agent.allowedSkills` and (per `orchestrator/003-teams`)
  `Team.allowedSkills` keep their existing `null` = unrestricted (every
  Skill available) / `[]` = none semantics (`orchestrator/002-multi-agent`
  AC1) — the values inside that array become real `Skill` ids instead of
  filenames.

## 3. `knowledge-store` — `Skill` CRUD

| Method & path | Body | Returns |
|---|---|---|
| `POST /skills` | `{ name, description, instructions }` | `201 Skill` |
| `GET /skills` | — | `200 Skill[]` |
| `GET /skills/:id` | — | `200 Skill` or `404` |
| `PUT /skills/:id` | same shape as create | `200 Skill` |
| `DELETE /skills/:id` | — | `204` |

```prisma
model Skill {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  name         String
  description  String
  instructions String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## 4. `orchestrator` changes

- `SkillManager` stops reading the filesystem at construction — it's built
  per-request in `graphRuntime.ts` from `KnowledgeStoreClient.listSkills()`
  (fail-open to `[]` on a `knowledge-store` hiccup, same as
  `AgentRegistry`'s `listAgents()`), exactly the same shape
  (`resolve(names): string`, `list(): SkillSummary[]`).
- `SkillRouter.route`'s second argument changes from `string[]` (names
  only) to `Array<{ name: string; description: string }>` — AC2's whole
  point is a real description to match against, and the router's prompt
  needs it to make that call correctly.

## 5. Defaults & Assumptions (mark any correction inline)

1. **All three fields required, no `null`-means-unrestricted pattern
   here** — unlike `Agent`'s `allowedTools`/`allowedSkills`, a `Skill`
   itself isn't a restriction list, it's a concrete thing with concrete
   content; there's no meaningful "unrestricted skill."
2. **No skill-of-skills nesting or versioning this round** — a `Skill` is
   flat: one description, one instructions body. Anthropic's own Agent
   Skills support bundled files/scripts for progressive disclosure; ALMA
   doesn't have a sandboxed execution environment to run those in, so this
   round deliberately stays at name+description+instructions only (see §6).

## 6. Out of Scope — Future Work

- Bundled resources/scripts per Skill (Anthropic's "Level 3" — needs a
  sandboxed execution environment ALMA doesn't have).
- Skill versioning / rollback.
- Marketplace or shared/importable skill libraries.

## 7. Open Questions — resolved 2026-09-17

- **OQ1 — Skill as its own entity vs. an attribute of Agent?** → **Own
  entity**, confirmed — Felix: "quiero tratar skills como cosas distintas
  a agentes." Matches the industry pattern researched this round
  (Anthropic's Agent Skills: a Skill is reusable knowledge/procedure, an
  Agent is who executes it — orthogonal concerns, not one config blob).
- **OQ2 — What happens to the existing `.md`-file skills on migration?**
  → **Auto-imported** into real rows the first time this ships (AC4) — the
  folder happens to be empty right now, but the migration path is built
  regardless.
