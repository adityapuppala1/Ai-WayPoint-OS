# Evaluation datasets

Golden datasets that gate every change to safety-critical logic and prompts.

| File | What it checks | Gate |
| --- | --- | --- |
| `datasets/crisis.jsonl` | Crisis tiering across 7 languages, including hard negatives (idioms) | Recall ≥ 0.95 for tier ≥ 2; no negative above its allowed max |
| `datasets/scam.jsonl` | Scam Shield verdicts on scams and legitimate messages | ≥ 0.90 of scams rated high/very high; ≤ 0.10 of legitimate rated high+ |

Each JSONL line is one case. Fields: `text`, `lang`, expected minimum `tier`/`level`, maximum
allowed (`max`), optional `other` (about someone else) and `cat` (category that must appear).

Run: `pnpm eval` (deterministic rules) — with AI keys configured it also scores the AI
second-opinion layers. Add a case for every false negative found in production review.

These datasets describe distressing situations so the safeguards can be tested. They were
written for this purpose and contain no real person's words. Non-English cases need
native-speaker and clinical review before launch in that language.
