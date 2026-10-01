# Load test

`run.mjs` is a small load test with no dependencies (Node 22 or newer). It answers one
question: how much can one web container carry, and what gets slow first?

Run it against a test installation, **never against one people are using**: it creates guest
sessions and sends thousands of requests.

## Running it

Against the compose stack, from inside its network, so the test reaches the web container
directly (the proxy would overwrite the visitor address every virtual visitor sends, and the
per-visitor limits would then treat them all as one person):

```bash
docker compose --env-file .env -f infra/docker/compose.yml up -d --build
docker run --rm --network waypoint_default -v "$PWD/infra/load:/load" node:22-bookworm-slim \
  node /load/run.mjs --url http://web:3000 --origin https://localhost --duration 20 --connections 50
```

(`--origin` is the site's public address, `https://` plus your `WAYPOINT_DOMAIN`: requests
that change something must come from it.)

Against a server on your own machine (`pnpm build && pnpm start`, with
`WAYPOINT_CLIENT_IP_HEADER=x-real-ip` so each virtual visitor counts as a separate person):

```bash
node infra/load/run.mjs --url http://localhost:3000 --duration 20 --connections 50
```

Options: `--duration` seconds per scenario (default 20), `--connections` visitors at once
(default 20), `--scenario` one or more of the names below, comma-separated (default all).
Results are printed and saved to `infra/load/results/` (not committed). The run exits with an
error when more than 1 % of requests fail.

## Scenarios

| Scenario | What it does | What it shows |
| --- | --- | --- |
| `health` | `GET /api/health` | The floor: the server and nothing else |
| `ready` | `GET /api/ready` | One round trip to the database |
| `welcome` | `GET /welcome` | A server-rendered page |
| `support` | `GET /api/support?country=KE` | Help lines, no session |
| `shield` | `POST /api/shield/check` | The scam rules engine (no AI) |
| `today` | `GET /api/today` as a guest | A session and several queries |
| `visitor` | Guest session → Today → help lines → scam check → Today | A first visit, each request timed |

## Baseline

Recorded on 30 September 2026, commit range of pull request "security, guardrails, forecasts,
deployment".

- **Machine:** AMD Ryzen AI 9 HX 370 (12 cores, 24 threads), 31 GB RAM, Windows 11, Docker
  Desktop 29.8 (Linux containers, 6 CPUs and 5.8 GB given to Docker).
- **Stack:** `infra/docker/compose.yml` — one `web` container (one Node process), Postgres 17
  with pgvector, the worker. No AI provider configured.
- **Load:** 50 visitors at once, 20 seconds per scenario, from a container on the same network.

| Scenario | Requests/s | p50 | p95 | p99 | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| `health` | 703 | 62 ms | 121 ms | 169 ms | 0 |
| `ready` | 665 | 72 ms | 107 ms | 125 ms | 0 |
| `welcome` | 49 | 953 ms | 1369 ms | 1504 ms | 0 |
| `support` | 636 | 71 ms | 129 ms | 173 ms | 0 |
| `shield` | 193 | 253 ms | 329 ms | 387 ms | 0 |
| `today` | 123 | 403 ms | 490 ms | 531 ms | 0 |
| `visitor` | 145 | 370 ms | 575 ms | 630 ms | 0 |

What the numbers say:

- **The web container is the limit, not the database.** It ran at 100 % of one CPU core
  throughout; Postgres stayed under 5 %. One web container uses one core, so capacity grows
  with the number of web containers (the Kubernetes autoscaler adds them on CPU).
- **Pages cost far more than API calls.** One core renders about 50 pages a second, against
  600–700 simple API answers. With 50 people loading a page at the same instant, each waits
  about a second. Plan on **one web container for every 40 page views a second** you expect at
  the busiest moment, and never fewer than two.
- **A scam check takes about 5 ms of CPU**, a guest's Today about 8 ms. Neither needs AI.
- These are numbers for one laptop. Run the test on your own servers before you rely on any of
  them, and again after every change that touches pages, sessions or the database.

Not covered: Ask with a real AI provider (its speed is the provider's), the texting webhooks,
and long-running soak tests.
