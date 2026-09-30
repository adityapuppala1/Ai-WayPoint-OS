# ADR 0001 — One TypeScript monorepo

**Status:** accepted · 2026-09-29

## Context
Web, mobile, API, worker and messaging channels must share the same safety logic exactly.
Duplicating the crisis classifier or scam rules across languages would let them drift.

## Decision
A pnpm + Turborepo monorepo in strict TypeScript. Domain logic lives in `@waypoint/core`
(pure functions, isomorphic), curated data in `@waypoint/content`, and every client calls one
Hono API. Next.js 16 hosts the web app and the API together for simple deployments.

## Consequences
One language and one test runner for everything; the same classifier protects web, mobile,
SMS and WhatsApp. The API can be split out (`apps/api`) without code changes.
