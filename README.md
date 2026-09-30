# Waypoint

**See what's coming. Know your next step. Never take it alone.**

Waypoint is a free, AI-native companion for life's big transitions — losing a job, starting
out, moving country, learning something new, or just trying to stay safe from scams. It shows
one clear next step at a time, builds plans that are honest about time, and puts safety first:
help lines and scam checks work even when AI is switched off.

---

## Quick start (Windows)

You need **Node.js 22.12 or newer** ([nodejs.org](https://nodejs.org), the "LTS" installer is fine).
Open **PowerShell** in this folder (`C:\xampp\htdocs\Ai_WayPoint`) and run:

```powershell
corepack enable pnpm      # one time: installs the pnpm package manager that comes with Node
pnpm install              # downloads dependencies (a few minutes the first time)
pnpm setup                # creates .env.local with fresh secrets
pnpm dev                  # starts Waypoint
```

Then open **http://localhost:3000**.

> If `corepack enable` says "permission denied", open PowerShell **as Administrator** once for
> that command, or install pnpm with `npm install -g pnpm@11`.

> **Do not open it through XAMPP** (`http://localhost/Ai_WayPoint`). Waypoint is a Node.js app;
> Apache would only expose source files. The included `.htaccess` blocks that on purpose.
> XAMPP's MySQL is not needed either — Waypoint ships with its own embedded Postgres.

### macOS / Linux

```bash
corepack enable pnpm && pnpm install && pnpm setup && pnpm dev
```

### Turn on the AI companion (optional)

Waypoint works without any AI key (it runs in **guided mode**). To enable real-time AI in Ask,
AI second opinions in Scam Shield and AI-worded plans, add **one** key to `.env.local`:

```ini
ANTHROPIC_API_KEY=sk-ant-...        # or OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
AI_MONTHLY_BUDGET_USD=25            # hard spending cap; guided mode takes over when reached
```

Restart `pnpm dev`. For a fully private setup, run a local model with [Ollama](https://ollama.com)
and set `OLLAMA_BASE_URL=http://localhost:11434` — no text leaves your machine.

People still control their data: text only goes to an external AI provider if they switch on
**"Use AI providers"** in Privacy settings, and it is redacted first (emails, phone numbers,
card, bank and ID numbers removed).

---

## What works in this version

| Area | Status |
| --- | --- |
| **Today** — one next step (the Sign), this week's route, what changed for you | ✅ |
| **Onboarding** — guest-first, two minutes, everything optional, privacy choices off by default | ✅ |
| **Path** — skills, role suggestions with honest AI-exposure notes, week-by-week plans, step tracking | ✅ |
| **Scam Shield** — rules engine + optional AI second opinion, report channels per country, scam library | ✅ |
| **Ask** — streaming AI companion with tools and approvals; guided mode without AI | ✅ |
| **Get help now** — verified emergency numbers for 48 countries, checked help lines for 47, and global directories | ✅ |
| **Crisis protocol** — multilingual detection before any AI call, calm support card, gentle follow-up | ✅ |
| **Services** — life-event checklists (job loss, moving country, new baby…) with official links | ✅ |
| **Signals** — sourced changes ranked for you, with "Why am I seeing this?" | ✅ |
| **What’s next?** — forecasts that staff publish and judge: each shows its chance as a number and in words (never 0% or 100%), its sources, what you can do either way and the day it will be judged. A public record shows how they turned out, with a score only once enough have been judged. Nothing is generated: with none published, the page says so | ✅ |
| **Settings & Privacy** — consents, trusted contacts (encrypted), export all data, delete account | ✅ |
| **Accounts** — guest sessions, email sign-up (guest data moves across), passkeys ready | ✅ |
| **Money** — runway on a cautious income, pressure level, the five most useful next steps, money-safety tips; numbers encrypted | ✅ |
| **Goals** — a few private goals with progress, and a weekly review (encrypted) | ✅ |
| **Mind** — mood check-ins with a two-week trend, a private journal, breathing and grounding; writing is screened for danger and encrypted | ✅ |
| **Circles** — small peer groups (up to 12) in your language: posts, wins, questions and check-ins, replies and reactions; personal details masked, scams and crisis posts held, anonymous reports | ✅ |
| **Health** — a quick daily log (sleep, movement, water, private note) with a calm weekly view, private reminders (encrypted) that appear on Today, and where to get care: emergency signs (stroke, heart attack, severe allergy, heatstroke) and checked non-emergency lines. Never diagnoses | ✅ |
| **Surroundings** — weather, air quality and UV where you are, turned into plain advice (heat, cold, storms, wind, sun, air); fetched by your device, so your location never reaches Waypoint; works offline from the last forecast | ✅ |
| **Organisations** — employers, schools, NGOs and public services run programmes with a join code, link, QR code and printable poster; people join in a minute (guests too) and choose, per programme, whether to be counted; the console shows only weekly, rounded, slightly noisy totals for groups of 50+ who chose it — never a person, never Mind, Health, Money, Circles, Ask or Shield. Teams with owner, admin and member roles (invitations need a confirmed email); every action audited | ✅ |
| **Admin console** — moderation queue for Circles (safety holds are only counted, never shown; writers are told what happened), scam-report review that warns people in Shield, AI spend against the budget, message delivery, and when each crisis line and emergency number was last checked | ✅ |
| **Texting** — SMS, WhatsApp and USSD for basic phones: help lines, scam checks in every language, short answers (AI only with consent), STOP respected; numbers sealed, nothing anyone writes kept ([setup](docs/CHANNELS.md)) | ✅ |
| **Email** — confirmation links, password resets and invitations in the reader's language, through Resend or any SMTP server | ✅ |
| **Phone app** (iOS and Android, Expo) — Today, Scam Shield that checks on the phone in every language, Ask with the support card, help lines that work offline, and settings; guest first, session in the phone's secure keystore ([details](docs/MOBILE.md)) | ✅ |
| **Languages** — English, हिन्दी, Español, Français, Português, العربية (right-to-left), Kiswahili: interface, Scam Shield results, skill/role names and plans. Non-English is beta until native speakers review it; long guidance is still English ([details](docs/LOCALIZATION.md)) | ✅ beta |

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the web app and API at http://localhost:3000 |
| `pnpm doctor` | Check your setup and explain any problem in plain words |
| `pnpm test` | Run all tests (safety classifier, Shield, plans, API, privacy…) |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | Lint and format check (Biome) |
| `pnpm build` then `pnpm start` | Production build and server |
| `pnpm db:seed --demo` | Add clearly-labelled example data (stop `pnpm dev` first) |
| `pnpm worker` | Background worker for Postgres deployments |
| `pnpm eval` | Run the safety evaluation sets against the classifiers, and the assistant guardrail cases (no AI key needed) |
| `pnpm check` | Lint, types and every unit test in one go (what CI runs) |
| `pnpm --filter @waypoint/web build` then `pnpm test:e2e` | Browser tests against the built app, at phone and desktop widths (first time: `pnpm --filter @waypoint/web exec playwright install chromium`) |
| `node infra/load/run.mjs` | The load test, against a server you name ([infra/load/README.md](infra/load/README.md) has the recorded baseline) |
| `pnpm --filter @waypoint/mobile dev` | Start the phone app (open it in Expo Go; see [docs/MOBILE.md](docs/MOBILE.md)) |

API documentation: http://localhost:3000/api/openapi.json (auth endpoints: `/api/auth/reference`).

---

## How it is built

```
apps/
  web/        Next.js 16 app (App Router) — the web app, installable PWA, and API host
  mobile/     Expo app for iOS and Android — same API, content and design system
  api/        The same API as a standalone Node service (for split deployments)
  worker/     Background jobs for Postgres deployments
packages/
  core/       Pure domain logic: crisis protocol, Scam Shield, planner, governor, privacy
  content/    Curated, sourced data: helplines, scams, skills, roles, courses, checklists
  db/         Drizzle schema + migrations; embedded Postgres (PGlite) or real Postgres
  auth/       Better Auth: guests, email, passkeys, organisations, admin
  ai/         AI gateway: providers, fallback, budgets, redaction, tools, guided mode
  api/        Hono + OpenAPI routes and the services behind them
  ui/         Design system (React Aria + wayfinding tokens)
  tokens/     Design tokens (single source for web and native)
  i18n/       Locales, messages, RTL
```

- **TypeScript everywhere**, strict mode; **Biome** for lint/format; **Vitest** for tests.
- **Zero-install database**: without `DATABASE_URL` Waypoint runs an embedded Postgres 18 with
  `pgvector` inside the app (data in `.data/`). Point `DATABASE_URL` at Postgres for production.
- **Safety never depends on AI**: crisis detection, help numbers and scam rules are
  deterministic, multilingual and tested.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/SAFETY.md](docs/SAFETY.md) ·
[docs/PRIVACY.md](docs/PRIVACY.md) · [docs/AI.md](docs/AI.md) ·
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) · [docs/LOCALIZATION.md](docs/LOCALIZATION.md) ·
[docs/CHANNELS.md](docs/CHANNELS.md) · [docs/MOBILE.md](docs/MOBILE.md) ·
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [SECURITY.md](SECURITY.md) ·
[docs/ROADMAP.md](docs/ROADMAP.md)

---

## Organisations and the admin console

- **Organisations** — any full account can set one up: account menu → **Organisations**
  (`/org`). Start a programme, then share its link, read out its code, or print its poster with a
  QR code. People join at `/join` (guests too) and decide separately whether to be counted.
- **Admin** — put `WAYPOINT_ADMIN_EMAIL` and `WAYPOINT_ADMIN_PASSWORD` (10+ characters) in
  `.env.local` before starting; that account is created on start (an existing account with that
  address is only promoted once its email is confirmed). Sign in with it and open **Admin** from
  the account menu (`/admin`) for moderation, scam reports, forecasts, AI spend, message
  delivery and the activity log. Everyone else gets a plain "not found" there.
- **Forecasts** — staff publish them at `/admin/forecasts`: a yes-or-no question, the chance
  (1 to 99%), why, at least one source, what people can do, and the day it will be judged.
  The question, how it is judged and the date cannot change afterwards; the chance can, and
  every chance it showed is scored. On the day, staff record what happened with a link anyone
  can check. People read them at `/signals/forecasts`; the record is at
  `/signals/forecasts/record` ([how it is scored](docs/SAFETY.md#forecasts)).
- **Confirming email addresses** — needed to invite colleagues and to answer an invitation.
  Set `EMAIL_FROM` and either `RESEND_API_KEY` or `SMTP_URL` to send real email. Without them,
  development prints the confirmation link (like password-reset links) in the terminal running
  `pnpm dev`: look for `outbox (development: not sent)` and open the `url`.
- **Texting** — SMS, WhatsApp and USSD work with Twilio, the WhatsApp Cloud API or Africa's
  Talking. [docs/CHANNELS.md](docs/CHANNELS.md) has the variables, the webhook addresses and the
  sender rules to follow; the public page `/text` shows people where to write.
- **Going live** — set `WAYPOINT_CLIENT_IP_HEADER` to the one header your edge sets
  (`cf-connecting-ip` behind Cloudflare, `x-real-ip` behind nginx), or keep X-Forwarded-For and
  list your proxies in `TRUSTED_PROXIES`, so rate limits apply to each visitor rather than to
  everyone at once — and cannot be dodged by sending a made-up header.
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) is the full guide: Docker Compose behind a reverse
  proxy, Kubernetes manifests (`infra/k8s/base`), migrations, backups, scaling and what the
  operator must do before opening to the public.
- **Security** — how to report a problem is in [SECURITY.md](SECURITY.md) and at
  `/.well-known/security.txt` (set `WAYPOINT_SECURITY_CONTACT`).
- **Privacy notice and terms** — `/privacy` and `/terms` are written in plain words in all seven
  languages and describe this installation: set `WAYPOINT_OPERATOR` (who runs it) and
  `WAYPOINT_CONTACT_EMAIL` so they name you, and `WAYPOINT_DATA_LOCATION` and
  `WAYPOINT_BACKUP_DAYS` if you can. Have both reviewed by a lawyer where you operate
  ([docs/PRIVACY.md](docs/PRIVACY.md#the-public-notice-and-terms)).

---

## Troubleshooting

- **"The embedded database is already open in another process"** — only one process can use
  the embedded database. Stop `pnpm dev` before `pnpm db:seed`, or use Postgres.
- **Port 3000 is busy** — run `pnpm --filter @waypoint/web exec next dev --port 3001` and open
  http://localhost:3001 (also set `WAYPOINT_URL=http://localhost:3001` in `.env.local`).
- **Start from a clean slate** — stop the app and delete the `.data` folder.
- Still stuck? `pnpm doctor` explains most problems.

## Important

Waypoint is not an emergency service and does not give medical, legal or financial advice.
Help-line numbers are checked against official sources (dates are shown next to each), but
services change — always confirm locally.
