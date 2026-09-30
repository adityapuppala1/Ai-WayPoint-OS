# Architecture

Waypoint is a TypeScript monorepo (pnpm workspaces + Turborepo). One Hono API serves every
client; the Next.js app hosts it at `/api` in development and small deployments, and
`apps/api` runs the same code as its own service when you need to scale it separately.

```
                ┌──────────────── clients ────────────────┐
                │ Web / PWA (Next.js)   Mobile (Expo)     │
                │ SMS · WhatsApp · USSD (provider webhooks)│
                └───────────────┬─────────────────────────┘
                                │  HTTPS, session cookie
                ┌───────────────▼─────────────────────────┐
                │ @waypoint/api  (Hono + OpenAPI)          │
                │  routes ─► services ─► core / ai / db    │
                └──┬──────────────┬──────────────┬─────────┘
                   │              │              │
     ┌─────────────▼──┐  ┌────────▼───────┐  ┌───▼──────────────┐
     │ @waypoint/core │  │ @waypoint/ai   │  │ @waypoint/db     │
     │ pure logic     │  │ providers,     │  │ Drizzle schema,  │
     │ crisis, Shield │  │ budgets, tools │  │ PGlite or        │
     │ planner, privacy│ │ guided mode    │  │ Postgres + pgvector│
     └────────┬───────┘  └────────────────┘  └──────────────────┘
              │
     ┌────────▼────────┐
     │ @waypoint/content│  curated, sourced reference data (versioned like code)
     └─────────────────┘
```

## Request flow

1. `apps/web/src/proxy.ts` sets a per-request CSP nonce and security headers for pages.
2. Pages (React Server Components) read the session and call **services** directly — no HTTP
   hop. Client components call `/api/*`.
3. `/api/*` is `packages/api/src/app.ts`: request id → database → CORS → CSRF (form posts) →
   body limit → Better Auth (`/api/auth/*`) → session → routes. Errors are RFC 9457 problem
   details; validation errors list the fields.
4. Services use `@waypoint/core` (deterministic logic), `@waypoint/ai` (optional AI) and
   `@waypoint/db`.
5. Texts arrive as provider webhooks at `/api/channels/*` (CSRF-exempt, verified by signature
   or secret key instead). `core/channels` decides the reply — crisis check first, then
   commands, then Scam Shield, then AI only with consent — and the API answers in the webhook
   (Twilio) or through the outbox. Email and texts that are sent later all go through the
   outbox and the worker ([CHANNELS.md](CHANNELS.md)).

## Packages

| Package | Responsibility |
| --- | --- |
| `core` | Crisis classifier and response plans (7 languages), Scam Shield rules and URL analysis, path planner, attention governor, money runway, forecasting maths, verifiable credentials, privacy (envelope encryption, redaction, k-anonymity). Isomorphic except `env`, `privacy`, `credentials`. |
| `content` | Emergency numbers (48 countries), checked help lines (47) and global directories, emergency numbers, scam patterns and report channels, life-event checklists and government portals, skills, roles, learning resources — every fact with a source URL and check date. |
| `db` | Drizzle schema (60 tables), SQL migrations, embedded PGlite (Postgres 18 + pgvector + pg_trgm) or node-postgres, job queue and transactional outbox. |
| `auth` | Better Auth: guest (anonymous) sessions that merge into accounts, email + password, phone OTP, passkeys, organisations, admin. |
| `ai` | Provider registry (Anthropic, OpenAI, Google, Ollama) with fallback and circuit breaker, budgets, usage/cost records, prompts, companion tools with approvals, guided mode, evaluations. |
| `api` | Hono routes with OpenAPI, services, background jobs. |
| `ui`, `tokens`, `i18n` | Design system, tokens, locales. |

## The phone app

`apps/mobile` (Expo SDK 57, React Native, Hermes) is another client of the same API. It
imports `@waypoint/core` subpaths (`/shield`, `/crisis`, `/text`, `/paths`), `@waypoint/content`,
`@waypoint/i18n` and `@waypoint/tokens` directly, so Scam Shield checks and help lines run on the
phone with no connection, and the crisis check runs there too when the server can't be reached.
Sessions come from Better Auth's Expo plugin (cookie in the secure keystore, `waypoint://`
origin). See [MOBILE.md](MOBILE.md).

## Data

- Without `DATABASE_URL`, the app runs an embedded Postgres in `.data/` (one process holds a
  lock). Migrations and reference data run automatically on start.
- With `DATABASE_URL`, run migrations as a deploy step (`pnpm db:migrate`) or set
  `WAYPOINT_AUTO_MIGRATE=true`, and run `pnpm worker` for background work.
- Sensitive fields (`…Ct` columns) are AES-256-GCM encrypted with a per-person data key, itself
  wrapped by the server key (`WAYPOINT_KEK`). See [PRIVACY.md](PRIVACY.md).

## Background work

`packages/api/src/jobs` — crisis follow-ups (as gentle in-app check-ins in the person's
language), nudge delivery through the attention governor (daily budget, quiet hours, dedupe),
conversation retention, stale guest clean-up and the outbox. It runs in-process with the
embedded database, or in `apps/worker` with Postgres.

## Decisions

See [adr/](adr/) for the reasoning behind the major choices.
