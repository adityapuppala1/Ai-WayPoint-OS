# ADR 0002 — Embedded Postgres for development and small installs

**Status:** accepted · 2026-09-29

## Context
Contributors and small NGOs should be able to run Waypoint with nothing but Node.js, while
production needs real Postgres with `pgvector`.

## Decision
Without `DATABASE_URL`, run PGlite (Postgres 18 in WebAssembly) with `pgvector` and `pg_trgm`
in-process, migrate and seed reference data on start, and guard it with a single-process lock.
With `DATABASE_URL`, use node-postgres and the same SQL migrations.

## Consequences
Zero-install local setup on Windows, macOS and Linux, identical SQL in development and
production. Only one process may open the embedded database, so background jobs run inside
the web server in that mode.
