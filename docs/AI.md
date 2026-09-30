# AI in Waypoint

AI makes Waypoint warmer and smarter; it is never required for safety.

## Where AI is used

| Feature | Model tier | Without AI |
| --- | --- | --- |
| Ask — the companion (streaming, tools, approvals) | small, or large in sensitive moments | Guided mode: built-in guidance with links |
| Scam Shield second opinion (structured output) | small | Rules engine only |
| Plan wording in the person's language | large | Deterministic planner's templates |
| Signal digests and tagging (worker) | small | Curated signals only |
| Forecast probabilities (worker) | large | Editor forecasts only |
| Embeddings for memory/signal search | embedding model | Full-text search |

## Providers and routing

`AI_PROVIDER_ORDER` (default `anthropic,openai,google,ollama`). The first configured, healthy
provider is used; failures open a circuit breaker and the next provider takes over. Without the
person's `ai_external` consent, only local models (Ollama) are used.

## Cost control

- `AI_MONTHLY_BUDGET_USD` is a hard cap across all features; daily per-person limits (guest 20,
  account 200 requests). Guided mode takes over when a limit is reached.
- Every call is **counted before it is made**, at its estimated cost, and settled at the real
  cost when it ends (`ai_usage`: tokens, cost, latency). Near the cap the check and the
  reservation happen under one lock, so a burst of requests cannot overshoot it, and an answer
  that is cut off part-way is still counted.
- Guest sessions are free to create, so they are bounded three ways: guests together can use
  at most 70 % of the monthly budget (the rest is kept for accounts); guests at one visitor
  address share 40 AI answers a day; and an address can start at most 300 guest sessions a
  day. The Scam Shield second opinion needs a session for the same reason.
- Set a spending limit with each AI provider as well: the cap here is an estimate from
  published prices, not a bill.

## The companion's tools

`find_support`, `check_message`, `suggest_roles`, `find_learning`, `money_runway`,
`life_checklist` run immediately (read-only). `create_goal`, `save_memory`, `draft_plan` need
the person's approval in the chat first.

## Prompts

`packages/ai/src/prompts` — plain language, honest about uncertainty, never invent numbers or
sources, stay within limits (no diagnosis, legal or financial advice), treat pasted content
as untrusted, and follow the crisis protocol for the current tier.
