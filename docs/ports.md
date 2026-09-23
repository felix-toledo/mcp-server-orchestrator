# Port Registry

Every service we build gets a port in the **30020+** range, assigned sequentially
and never reused after being retired. This repo used to scatter port numbers
across `.env`, `docker-compose.yml`, and hardcoded fallbacks in source, and they
all disagreed with each other. This file is now the single source of truth —
if a `.env` or `docker-compose.yml` value disagrees with this table, the table
wins and the config is a bug.

| Port  | Service         | Status          | Notes                                              |
| ----- | --------------- | --------------- | --------------------------------------------------- |
| 30020 | mcp-server      | active          | `services/mcp-server` — exposes MCP tools           |
| 30021 | orchestrator    | active          | `services/orchestrator` — coordinates LLM ↔ MCP     |
| 30022 | frontend        | active          | Next.js — ALMA onboarding, chat, and vault explorer/editor |
| 30023 | telegram-bot    | active          | outbound long-polling to Telegram; port serves its own `/health`, `/config`, `/push` |
| 30024 | whatsapp-bot    | planned         | same shape as telegram-bot                          |
| 30025 | knowledge-store | active          | owns Postgres/pgvector (Prisma) + vault filesystem I/O, called by mcp-server and frontend |
| 30026 | scheduler       | active          | `pg-boss`-backed reminder/agenda queue, see `scheduler/001-agendas` |
| 30027 | ops-connector   | planned         | scoped external execution — local terminal, SSH to configured hosts, HTTP API/DB access; see `ops-connector/001-external-execution` (Draft/backlog, security Open Questions unresolved) |
| 30028 | voice-assistant | active          | first **Python** service — wake-word detection + speaker verification + local STT/TTS voice channel; see `voice-assistant/001-wake-word-channel`. Exposes a minimal `/health` endpoint for `dev-all.mjs` parity even though it's a daemon, not an HTTP server — see plan.md §1. |

## Rules

- **Check before you claim one.** Before wiring up a new service, confirm the
  port isn't already bound on the target machine (`netstat`/`lsof`) — this
  table tracks intent, not runtime reality.
- **One service, one `PORT`.** Each service reads a single `PORT` env var from
  its own local `.env` (see `services/<name>/.env`) — not a per-service-named
  var like `MCP_SERVER_PORT`. `docker-compose.yml` and the root `.env` still use
  descriptive names (`MCP_SERVER_PORT`, `ORCHESTRATOR_PORT`, ...) because they
  need to address multiple services from one file, and map each one to that
  service's container `PORT`.
- **Retiring a port**: mark it `retired` here with the date and don't reassign
  the number to a new service — keeps old logs/docs unambiguous.
- New service → add a row here in the same PR that adds the service.
