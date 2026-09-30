# ADR 0003 — Safety runs before, and without, AI

**Status:** accepted · 2026-09-29

## Context
Language models can miss risk, invent phone numbers, be unavailable or be over budget.

## Decision
Crisis detection, help numbers and scam rules are deterministic and multilingual, run before
any model call, and can suppress or constrain the AI reply. AI may only add warmth, context
and extra caution (Shield's AI can only raise a risk level). Numbers come only from verified,
sourced data via the `find_support` tool.

## Consequences
Safety behaviour is testable and release-gated (`pnpm eval`), works offline and in guided
mode, and costs nothing per request.
