# Kubernetes

Manifests for a split deployment (web, worker, migrations job, Postgres with pgvector) are
planned for a coming update. Until then, the images in `infra/docker/Dockerfile` run on any
container platform:

- `web` target — stateless, scale horizontally; needs `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `WAYPOINT_KEK`, `WAYPOINT_URL`, `WAYPOINT_OPERATOR` and `WAYPOINT_CONTACT_EMAIL` (named in the
  privacy notice and terms) and, optionally, AI keys.
- `worker` target — run 1+ replicas with the same environment; also used for the migration
  job: `pnpm --filter @waypoint/db migrate`.
- Health: `GET /api/health` (liveness), `GET /api/ready` (readiness, checks the database).
