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
| 30022 | frontend        | planned         | Next.js web channel (not scaffolded yet)            |
| 30023 | telegram-bot    | planned         | outbound long-polling to Telegram; port reserved for its own `/health` endpoint only |
| 30024 | whatsapp-bot    | planned         | same shape as telegram-bot                          |
| 30025 | database-admin  | reserved        | placeholder if a dedicated DB-facing service is ever split out of mcp-server |

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
