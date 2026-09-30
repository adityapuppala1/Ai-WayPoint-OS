# Deployment

How to run Waypoint for real people: on one server with Docker Compose, or on Kubernetes.
Read [Before you go live](#before-you-go-live) whichever you choose.

What was tested, and what was not: the Compose stack in this guide was built and run end to end
(HTTPS through the proxy, migrations, the web app on a read-only file system, the worker, rate
limits behind the proxy). The Kubernetes manifests were checked against the Kubernetes API
schemas (versions 1.29 and 1.31, strict) but **not run in a cluster**: try them in a staging
cluster before you depend on them.

## What runs

| Part | What it does | How many |
| --- | --- | --- |
| **Proxy** | The only door in: HTTPS, the visitor's address, request size limits | One (Caddy in Compose; your ingress on Kubernetes) |
| **Web** | The website and the API (`/api`). Stateless | Two or more behind the proxy; one in Compose |
| **Worker** | Follow-ups after a hard moment, reminders, queued email and texts, weekly totals for organisations, retention, key re-wrapping | One is enough; several are safe |
| **Migrations** | Creates and updates the database tables, loads help lines and starter circles | Once per release, before the new version starts |
| **Postgres** | Everything that is stored. Needs the `vector` (pgvector) and `pg_trgm` extensions | One, with backups |

Nothing else is needed. AI, email and texting are optional and switched on by settings.

## Settings

Every setting is an environment variable; `.env.example` lists them all with explanations.
These are the ones a production installation must get right.

| Setting | What it is | Notes |
| --- | --- | --- |
| `WAYPOINT_URL` | The public address, e.g. `https://waypoint.example.org` | Must be `https://`. A production server refuses anything else (except `localhost`). |
| `BETTER_AUTH_SECRET` | Signs sessions, sign-in links and approvals | 32 characters or more, random. A production server refuses less. |
| `WAYPOINT_KEK` | Wraps each person's own data key | 32 random bytes, base64. **Keep a copy somewhere safe and separate from database backups**: without it nothing private can ever be read again. |
| `DATABASE_URL` | Postgres | With TLS (`?sslmode=require` or stricter) unless the database is on the same private network. |
| `WAYPOINT_CLIENT_IP_HEADER` | The one header your proxy sets with the visitor's address | `x-real-ip` for the proxy in this guide and for ingress-nginx; `cf-connecting-ip` behind Cloudflare. Without it, rate limits can be dodged. |
| `WAYPOINT_OPERATOR`, `WAYPOINT_CONTACT_EMAIL` | Who runs this Waypoint, and how to reach them | Shown in the privacy notice and terms; data protection law requires it. |
| `WAYPOINT_SECURITY_CONTACT` | Where to report a security problem | Shown in `/.well-known/security.txt`. |
| `EMAIL_FROM` with `SMTP_URL` or `RESEND_API_KEY` | Sending email | Without it nobody can confirm an address, so nobody can sign in to a new account. SMTP must use TLS (`smtps://`, or `smtp://` on a server that offers STARTTLS). |
| `WAYPOINT_ADMIN_EMAIL`, `WAYPOINT_ADMIN_PASSWORD` | The first staff account | Created on first start. Use a long password and remove `WAYPOINT_ADMIN_PASSWORD` afterwards. |

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## One server with Docker Compose

You need a server with Docker, a domain name pointing at it, and ports 80 and 443 open.

1. Get the code and create the settings file:

   ```bash
   git clone https://github.com/adityapuppala1/Ai-WayPoint-OS.git waypoint && cd waypoint
   cp .env.example .env
   ```

2. In `.env`, set at least:

   ```ini
   WAYPOINT_DOMAIN=waypoint.example.org
   POSTGRES_PASSWORD=          # long and random, letters and digits only
   BETTER_AUTH_SECRET=         # see "Generate the two secrets" above
   WAYPOINT_KEK=
   WAYPOINT_OPERATOR=Example Trust, 1 Road, Nairobi, Kenya
   WAYPOINT_CONTACT_EMAIL=privacy@example.org
   EMAIL_FROM=Waypoint <hello@example.org>
   SMTP_URL=smtps://user:password@mail.example.org:465
   ```

   A database password of letters and digits:
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   The stack refuses to start without `WAYPOINT_DOMAIN` and `POSTGRES_PASSWORD`: there is no
   default password.

3. Start it:

   ```bash
   docker compose --env-file .env -f infra/docker/compose.yml up -d --build
   ```

   The first build takes several minutes. The proxy gets an HTTPS certificate for your
   domain by itself. When `docker compose -f infra/docker/compose.yml ps` shows `web` and
   `proxy` as healthy, open `https://your-domain`.

4. Check it: `pnpm doctor https://your-domain` from a checkout, or open
   `https://your-domain/api/ready`.

**Updating:** `git pull`, then the same `up -d --build` command. Migrations run first; the web
app and worker start only when they have finished.

**Backups:** the database is the only thing to back up (plus your copy of `WAYPOINT_KEK`).

```bash
docker compose -f infra/docker/compose.yml exec -T db pg_dump -U waypoint -Fc waypoint > waypoint-$(date +%F).dump
```

Run it every night from cron, copy the file off the server, and **restore one into a test
stack before you need to** (`pg_restore -U waypoint -d waypoint --clean`). Set
`WAYPOINT_BACKUP_DAYS` to how long you keep them, so the privacy notice can say.

**Logs:** `docker compose -f infra/docker/compose.yml logs -f web worker`. They are JSON
lines and never contain what people wrote, email addresses or phone numbers. The proxy keeps
no access log by default (see the note in `infra/docker/Caddyfile` before turning one on).

Compose runs one web container. For more than a few dozen page views a second at the
busiest moment, move to several web containers behind a load balancer — which is what the
Kubernetes setup does.

## Kubernetes

The manifests are in `infra/k8s/base` (kustomize). You bring: a cluster with an ingress
controller and the metrics server, a Postgres database with the `vector` and `pg_trgm`
extensions (a managed one is simplest), and a container registry.

1. Build and push the two images (any version tag you like; never `latest`):

   ```bash
   docker build -f infra/docker/Dockerfile --target web -t registry.example.org/waypoint-web:0.1.0 .
   docker build -f infra/docker/Dockerfile --target worker -t registry.example.org/waypoint-worker:0.1.0 .
   docker push registry.example.org/waypoint-web:0.1.0
   docker push registry.example.org/waypoint-worker:0.1.0
   ```

2. In `infra/k8s/base` (or an overlay of your own) set the image names in
   `kustomization.yaml`, your address and contact details in `configmap.yaml`, and your host
   name in `ingress.yaml`.

3. Create the namespace and the Secret (never commit real values; `secret.example.yaml` shows
   the names):

   ```bash
   kubectl apply -f infra/k8s/base/namespace.yaml
   kubectl -n waypoint create secret generic waypoint-secrets \
     --from-literal=DATABASE_URL='postgres://waypoint:…@db.internal:5432/waypoint?sslmode=require' \
     --from-literal=BETTER_AUTH_SECRET='…' \
     --from-literal=WAYPOINT_KEK='…'
   ```

4. Deploy. The migration job runs first; wait for it before trusting the rollout:

   ```bash
   kubectl -n waypoint delete job waypoint-migrate --ignore-not-found
   kubectl apply -k infra/k8s/base
   kubectl -n waypoint wait --for=condition=complete job/waypoint-migrate --timeout=10m
   kubectl -n waypoint rollout status deployment/waypoint-web
   ```

**What the manifests give you**

- **Web:** two pods to start with, spread over nodes; liveness on `/api/health` (the process
  answers) and readiness on `/api/ready` (the database answers), so a database outage takes
  pods out of service without restarting them; rolling updates that never go below the
  current number of pods; a read-only file system, no root, no extra privileges.
- **Autoscaling:** 2 to 10 web pods on CPU (70 %) and memory (80 %). One pod uses about one
  core; see [infra/load/README.md](../infra/load/README.md) for what that carries.
- **Disruption budget:** node maintenance never takes the last web pod.
- **Worker:** one pod, which finishes its round before it stops.
- **Migration job:** once per release. Migrations only ever add, so the version still running
  keeps working while the new one rolls out.
- **Network policy:** only the ingress controller can reach the web pods; nothing can reach
  the worker. Change the namespace label in `networkpolicy.yaml` to your ingress controller's.

**Updating:** build and push new images, change the tags in `kustomization.yaml`, and run
step 4 again. **Rolling back:** `kubectl -n waypoint rollout undo deployment/waypoint-web`
(and the worker); database changes stay, which is safe because they only add.

## Before you go live

Work through this list. Each line is something only the operator can do.

**Secrets and keys**

- [ ] `BETTER_AUTH_SECRET` and `WAYPOINT_KEK` are random, set only in your secret store, and
      not the values from any example or test.
- [ ] A copy of `WAYPOINT_KEK` is kept offline, separate from database backups.
- [ ] You know how to rotate it (below) and have done it once in staging.
- [ ] `WAYPOINT_ADMIN_PASSWORD` was removed after the first start; the admin account has a
      long, unique password.

**The way in**

- [ ] HTTPS only. `WAYPOINT_URL` starts with `https://`, and the certificate renews itself.
- [ ] The app is reachable **only** through your proxy or ingress. Nothing publishes port 3000.
- [ ] `WAYPOINT_CLIENT_IP_HEADER` (or `TRUSTED_PROXIES`) matches your proxy. Test it: twenty-one
      feedback posts in an hour from one address must get "too many requests" on the last,
      whatever `X-Forwarded-For` you send.
- [ ] If you log requests at the proxy, query strings are left out (the Africa's Talking
      callback address carries a secret).

**Who you are**

- [ ] `WAYPOINT_OPERATOR`, `WAYPOINT_CONTACT_EMAIL` and `WAYPOINT_SECURITY_CONTACT` are set;
      `/privacy`, `/terms` and `/.well-known/security.txt` name you.
- [ ] A lawyer has read the privacy notice and terms for each country you serve.

**The database**

- [ ] Connections use TLS, and the database is not reachable from the internet.
- [ ] Backups run every night and one has been restored successfully.
- [ ] The disk is encrypted (Ask conversations are stored readable; see PRIVACY.md).

**Background work**

- [ ] The worker is running (its log shows `worker started`, then `retention` every six
      hours). Without it no email is sent, so nobody can confirm an address.
- [ ] Email works: create an account and open the link.

**Money**

- [ ] `AI_MONTHLY_BUDGET_USD` is set, **and** a spending limit is set with the AI provider
      itself. The cap here is an estimate from published prices, not a bill.
- [ ] Texting: your provider's geographic permissions allow only the countries you serve, and
      `WAYPOINT_TEXT_REPLIES_PER_HOUR` / `_PER_DAY` match what you are willing to pay.

**People**

- [ ] Help lines for your countries were checked with the services themselves (SAFETY.md).
- [ ] Someone reads the admin console (moderation, scam reports) every day.
- [ ] Someone receives mail sent to the security contact.

## Looking after it

**Is it healthy?** Watch `/api/ready` from outside (it answers 503 when the database does not),
the web and worker logs for lines with `"level":"error"`, and the admin overview
(`/admin`) for messages that could not be sent and AI spend against the budget.

**How big should it be?** One web container uses one CPU core. On the reference machine that
carried about 50 page views or 600 simple API answers a second
([baseline](../infra/load/README.md)). Run the load test on your own servers and size for
your busiest moment with room to spare; the database was idle throughout, so add web
containers first.

**Rotating the server key (`WAYPOINT_KEK`)**

1. Generate a new key. Set it as `WAYPOINT_KEK` and move the old one to
   `WAYPOINT_KEK_PREVIOUS`. Restart web and worker.
2. The worker re-wraps every person's data key under the new key (up to 500 each time its
   retention job runs, every six hours; `pnpm worker --once` runs it now). Its log line
   `retention` shows `"keys":{"dataKeys":…,"remaining":…}`.
3. When `remaining` is 0, remove `WAYPOINT_KEK_PREVIOUS` and restart. Keep the old key in your
   offline store for as long as you keep backups made before the rotation.

**Rotating the session secret (`BETTER_AUTH_SECRET`)** signs everyone out and resets rate-limit
counters; pending approvals in Ask must be asked again. Do it when you suspect it leaked, not
on a schedule.

**Upgrades.** Read the release notes, deploy to staging, run `pnpm test:e2e` against it
(`E2E_BASE_URL=https://staging…`), then production. One-time links and codes issued before
an upgrade that changes how they are stored stop working; people ask for a new one.

**If something goes wrong.** Take the app out of service at the proxy rather than deleting
anything. The database and your copy of `WAYPOINT_KEK` are everything you need to bring it
back. For a security problem, see [SECURITY.md](../SECURITY.md).
