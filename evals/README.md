# Evaluation datasets

Golden datasets that gate every change to safety-critical logic and prompts.

| File | What it checks | Gate |
| --- | --- | --- |
| `datasets/crisis.jsonl` | Crisis tiering across 7 languages, including hard negatives (idioms) | Recall ≥ 0.95 for tier ≥ 2; no negative above its allowed max |
| `datasets/scam.jsonl` | Scam Shield verdicts on scams and legitimate messages | ≥ 0.90 of scams rated high/very high; ≤ 0.10 of legitimate rated high+ |
| `datasets/guardrails.jsonl` | The assistant's guardrails, against a scripted stand-in model (no AI key) | Every case passes |

Each JSONL line is one case. Fields: `text`, `lang`, expected minimum `tier`/`level`, maximum
allowed (`max`), optional `other` (about someone else) and `cat` (category that must appear).

Run: `pnpm eval`. Everything is deterministic and needs no AI key. The guardrail cases blank
every outside key on this machine first (the AI providers' and the judge's), so nothing is ever
sent. Add a case for every false negative found in production review.

### Guardrail cases

Each line of `guardrails.jsonl` has an `id`, a `why` (one sentence, shown when it fails) and a
`kind`:

- `ask` — a conversation (`say`) answered by a scripted model (`script`: each step is
  `{"text": …}` or `{"tool": …, "input": …}`), optionally followed by an answer to a request
  for approval (`respond`: approved or not, with a forged signature, a changed input, or moved
  to another request). `expect` checks what happened: how often a model was called, whether
  the support card came first, which tools asked for approval or ran, what was saved, and what
  the model was (and was not) sent.
- `tool` — one read-only tool run directly: it must write nothing, and its result can be
  checked with patterns.
- `prompt` and `channel-prompt` — rules that must appear in the instructions a model is
  given, for all seven languages and every level of concern.
- `judge` — one use of the judge (TypeSafe's Jev: `use` is `shield`, `reply`, `plan` or
  `intent`) with a scripted stand-in for the service. `judge` says what it answers to each
  question by id (a probability, or a choice), or how it fails (`"error"`, `"timeout"`);
  `modelSays` is what a scripted language model answers, when there is one; `consent: false`
  means the person did not allow outside AI. `expect` checks how often the judge and the model
  were called, what the judge was and was not sent (in the state, and in its questions), and
  the outcome: for Shield the level (`level`, `sameAsRules`, and always that it is not below
  the rules'), who answered and the reasons added; for an answer by text whether it would be
  `sent` or the guided text instead; for a plan whose `wording` it ends up with; for guided
  mode the reply.

A case that passes for the wrong reason is worse than none: when you add one, break the
guardrail it protects once and watch it fail.

These datasets describe distressing situations so the safeguards can be tested. They were
written for this purpose and contain no real person's words. Non-English cases need
native-speaker and clinical review before launch in that language.
