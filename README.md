# apteva-demo

Client-facing demo runner for Apteva agents. One screen showing
business-state cards (companies, deals, tickets) pulled live from the
agent's connected MCP servers, plus operator controls to seed/reset
test data and trigger scripted scenarios. Includes a chat dock so a
client can ask the agent live questions without leaving the demo
screen.

Same structural pattern as [`simple`](../simple) — `kind: static`,
mounted at `/demo` by default, registered as a built-in app via
`apteva.yaml`. No sidecar, no extra container.

## Why this app exists

`simple` is great for "watch the agent think" but wrong for client
meetings. Clients don't want to see threads and event streams — they
want to see **their world being changed by the agent**. `demo`
collapses that into one screen: a state board on the left, operator
controls on the right, a floating chat dock, and a one-click
seed/reset cycle for clean repeats between meetings.

## Layout

```
┌──────────────────────────────────────────────────────┬──────────────┐
│  Customer state                                      │  Profile ▾   │
│  ┌────────┐ ┌────────┐ ┌────────┐                    │  Demo data   │
│  │ 🔴 Acme│ │🟡Globex│ │🟡Initech│                    │  [Seed]      │
│  └────────┘ └────────┘ └────────┘                    │  [Reset]     │
│                                                      │  Trigger     │
│  Recent agent activity                               │  [✉ Acme]    │
│  • 14:02 → search_crm_objects(...)                   │  [✉ Globex]  │
│  • 14:01 ✓ manage_crm_objects (1.2s)                 │  [✉ Initech] │
│  • 13:58 → search_crm_objects(...)                   │  Agent       │
│                                                      │  [⏸ Pause]   │
└──────────────────────────────────────────────────────┴──────────────┘
                                                  ┌──────────────┐
                                                  │ Chat with    │ ← floating dock
                                                  │ the agent    │
                                                  └──────────────┘
```

## Demo profiles

Every demo (HubSpot email-monitor, Salesforce pipeline, etc.) is one
JSON file in `src/demos/`. Add a profile, no UI code change.

A profile declares:

- **`scenarios`** — cards on the board. Each carries a `live_query`
  (an MCP tool call run every 5s to populate the card) and a
  `trigger.message` (sent into the agent via `POST /instances/:id/event`).
- **`seed.steps`** — a sequence of MCP calls that build up the test
  data. Steps can capture IDs from earlier responses and substitute
  them into later ones via `${var}` placeholders.
- **`reset.steps`** — finds demo-owned records via filtered searches
  so the operator can wipe them. (MVP: read-only — extends to archive
  in v0.2.)
- **`primary_mcp`** — the slug of the MCP server the runner targets
  (e.g. `hubspot`).

See `src/demos/hubspot-email-monitor.json` for a complete example.

## URL parameters

| Param        | Effect                                                   |
|--------------|----------------------------------------------------------|
| `?demo=ID`   | Pick the profile to load (default: from app config)      |
| `?instance=N`| Bind to a specific Apteva instance instead of auto-pick  |
| `?project=ID`| Filter the instance auto-pick to one project             |
| `?api_key=K` | Kiosk mode — skip login, use the key for all calls       |

## Endpoints consumed

All under `/api`, session cookie or `X-API-Key` auth:

| Area         | Endpoints                                                |
|--------------|----------------------------------------------------------|
| Auth         | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`  |
| Instances    | `GET /instances`, `GET /instances/{id}`                  |
| Instance     | `POST /instances/{id}/{start,stop}`, `POST /event`       |
| MCP          | `GET /mcp-servers`, `POST /mcp-servers/{id}/call-tool`   |
| Telemetry    | **`GET /telemetry/stream`** (SSE)                        |
| Chat         | `/apps/channel-chat/{chats,messages,stream}`             |

## Development

```bash
bun install
bun run build       # → dist/
bun run dev         # rebuild on change
```

To install locally into a running apteva-server:

```bash
BUILTIN_APPS_DIR=/path/to/local/apps ./scripts/install-into-server.sh
# Then restart apteva-server to pick up the new manifest.
```

## Build-time env

| Var               | Default | What it does                      |
|-------------------|---------|-----------------------------------|
| `API_BASE`        | `/api`  | Base URL for all server calls     |
| `DEFAULT_PROJECT` | ``      | Default project id for auto-pick  |

## Three ways to deploy

### 1. Built-in to apteva-server (production pattern)

`apteva-server`'s Dockerfile bakes `dist/` + `apteva.yaml` under
`/opt/apteva/apps/demo/`. `RegisterBuiltinApps` walks that directory
on boot and adds the row to the catalog. Operators install via the
dashboard's Apps tab.

### 2. Standalone Docker container (reverse-proxy mode)

```bash
docker build -t apteva-demo .
docker run -p 8089:80 -e APTEVA_SERVER_URL=http://your-server:8080 apteva-demo
```

The container serves the static bundle and reverse-proxies `/api` to
the apteva-server.

### 3. Drop into apteva-server's data dir locally

```bash
BUILTIN_APPS_DIR=/opt/apteva/apps ./scripts/install-into-server.sh
# restart apteva-server
```

Same-origin, cookie auth works, no proxy needed.
