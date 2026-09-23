# Tasks — Skills as a managed entity

Base: [`plan.md`](./plan.md) §5.

- [x] **T1 — `knowledge-store`: `Skill` schema + service + HTTP surface**:
  migration `20260917222644_add_skill_and_team` (landed together with
  `orchestrator/003-teams`'s `Team` model — one migration, both new tables
  needed around the same time, same efficiency call `004`'s tasks.md
  already made once), `SkillService`, `skillsController`, routes. Tests:
  6 in `skillService.test.ts` + 7 route tests in `server.test.ts`. Verified
  live: created a real Skill via the HTTP API, listed it back correctly.
- [x] **T2 — Migration script**: `src/scripts/migrateFsSkills.ts` —
  `parseFsSkills` (pure, testable) parses `.md` files into
  `{name, description, instructions}`; `description` is a best-effort
  guess (first non-empty line, `#` stripped) since the legacy format has
  no frontmatter. Placed under `src/scripts/` (not a top-level `scripts/`)
  specifically so it's covered by `vitest.config.ts`'s existing
  `src/**/*.test.ts` glob — a sibling top-level `scripts/` dir (mirroring
  `mcp-server`'s own) would have needed its own vitest include pattern.
  5 tests against a real temp fixture folder (`mkdtemp`), including the
  empty-folder and missing-folder fail-open cases. `pnpm run migrate:skills`
  (new script) runs it against the real `services/orchestrator/skills/`
  path by default. Nothing to migrate for real yet — that folder is empty
  (confirmed at spec time).
- [x] **T3 — `orchestrator`: `SkillManager` constructor change**: takes an
  injected `SkillSummary[]` (now `{id, name, description, instructions}`,
  not just filenames) instead of reading the filesystem — the
  module-level singleton and its `fs.readdirSync` call are gone entirely.
  Tests: 7 in `SkillManager.test.ts`.
- [x] **T4 — `SkillRouter.route`'s signature change**: `availableSkills`
  is now `AvailableSkill[]` (`{name, description}`), and the prompt lists
  `"name: description"` pairs instead of bare names (AC2). Tests: added
  one asserting the description actually reaches the prompt, existing
  tests updated to the new shape.
- [x] **T5 — `graphRuntime.ts` wiring**: fetches `Skill[]` (alongside
  `Agent[]`/`Team[]`/`VaultFolder[]`, all in one `Promise.all`) from
  `knowledge-store` per request, builds a fresh `SkillManager` from it.
  Implemented together with `orchestrator/003-teams`' own `graphRuntime.ts`
  changes — same request-scoped-config pattern, same file, one pass.
- [x] **T7 — Frontend**: `frontend/004-chat-shell` AC9's "Agentes y Skills"
  tab only ever grew Agent CRUD, not Skill CRUD, despite its own name —
  found live by Felix after the backend/`orchestrator` work above shipped.
  Added `SkillList.tsx` (mirrors `AgentList.tsx`'s create-form + list
  pattern exactly) plus `list-skills`/`create-skill`/`delete-skill`
  server actions (same direct-`fetch`-to-`knowledge-store` shape the
  existing agent actions already use, not the `lib/` client layer
  `list-vault-folders` uses — matched the *local* precedent for this
  specific tab's code, not the idealized layering). The single `/agents`
  page now hosts three sub-tabs (Agentes / Skills / Equipos) via a new
  `AgentsSkillsTeamsPanel.tsx` wrapper — see `orchestrator/003-teams`
  tasks.md for the Team half of this same UI pass. Tests: 9 across the
  three new actions. **Near-miss caught, not a real incident**: almost
  ran `pnpm run build` for a typecheck while `dev:frontend` was live
  (exactly the corruption CLAUDE.md's frontend section already warns
  about) — caught it via `netstat` right after and recovered with the
  documented fix (kill the real `next-server` PID via
  `Get-NetTCPConnection`, `rm -rf .next`, restart) before it visibly
  broke anything. Verified live: created a real agent/skill/team via the
  HTTP API and confirmed the server-rendered `/agents` page's HTML
  reflected all three by name.
- [x] **T6 — Manual end-to-end**: verified live end to end, not just
  CRUD — created a real Skill ("pirata": description "Usar cuando el
  usuario pida explícitamente que le hables como un pirata.") via the
  HTTP API, then asked the main chat "hablame como un pirata, contame que
  dia es hoy." `SkillRouter` correctly matched the request against the
  skill's *description* (AC2 — not just its name) and selected it, and
  the reply came back genuinely in pirate jargon throughout ("¡Arr,
  marinero!... ¡arr!"), confirming the instructions actually reached the
  system prompt via the new DB-backed `SkillManager`.
