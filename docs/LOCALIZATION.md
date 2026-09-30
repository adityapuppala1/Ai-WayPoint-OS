# Languages and localization

Waypoint ships in seven languages: English, हिन्दी, Español, Français, Português, العربية and
Kiswahili. English is the source; every other language falls back to English **key by key**, so a
missing string never breaks a screen or hides a warning.

> **Status: beta.** The six non-English languages were drafted with AI assistance and have not yet
> been reviewed by native speakers. Before public launch each language needs a native reviewer —
> and safety copy (crisis, Scam Shield, Get help now) needs review by someone who works in that
> field. The language picker labels these languages as beta (`localeStatus` in `@waypoint/i18n`).

## What is translated where

| Layer | Where it lives | How it is chosen |
| --- | --- | --- |
| Interface text (≈650 strings) | `packages/i18n/messages/*.json` | `next-intl` on the web; the language cookie, then `Accept-Language` |
| Scam Shield warning signs and advice | `packages/core/src/shield/l10n/*.ts` | The engine returns text in the requested locale, so web, SMS, WhatsApp and guided Ask all agree |
| Skill, role and role-family names | `packages/content/src/l10n/*.ts` | `skillName`, `roleTitle`, `localizeRole`, `localizeSkill` |
| Plan text | Planner templates in the messages (`planTemplates`) | Plans store *how* each line was written (template key + ids), and are rendered in the reader's language every time they are shown |
| Crisis replies and follow-ups | `packages/core/src/crisis`, `packages/api/src/jobs` | Per locale, reviewed separately (see SAFETY.md) |
| Guided-mode Ask replies | `packages/ai/src/offline.ts` | Per locale; module names match the translated navigation |
| Long guidance (checklists, scam library, role and skill descriptions, report-channel notes) | `packages/content` | **English for now.** Pages show a short note in the person's language and mark the English text with `lang="en"` so screen readers switch voice |

Long guidance is deliberately not machine-translated: it contains legal and safety detail that
must be translated and checked by people. Add translations as overlays keyed by id (the same
pattern as `content/src/l10n`), never by editing the English source.

## Rules that keep this working

- **Placeholders must match.** `packages/i18n/test/messages.test.ts` fails if a translation adds,
  drops or renames an ICU argument, or uses a key English doesn't have.
- **Numbers use ICU number arguments** (`{count, number}`), plural forms use `plural` with the
  categories the language needs (Arabic uses zero/one/two/few/many/other).
- **Every Shield signal and piece of advice is translated in every language** — enforced by
  `packages/core/test/shield-l10n.test.ts` against the engine's own ids.
- **Every skill, role and family name is translated** — enforced by
  `packages/content/test/integrity.test.ts`.
- **Short labels live beside long ones** (`shell.helpShort`, `a11y.quickExitShort`). The short
  word must appear inside the long label so the accessible name still contains the visible text
  (WCAG 2.5.3).
- **Buttons wrap** rather than overflow, and the phone header shows only the logo mark so help
  and quick exit always fit — tested at 320 px in French, Arabic and Swahili.
- **Arabic is right-to-left.** Layout uses logical properties (`inline-start`, `block-end`);
  directional icons flip with `wp-icon-directional`.

## Adding a language

1. Add the code to `locales`, `localeNames` and `localeStatus` in `packages/i18n/src/index.ts`
   (and `LOCALES` in `packages/core/src/types.ts`).
2. Copy `en.json` to `<code>.json` and translate. Run `pnpm --filter @waypoint/i18n test`.
3. Add `packages/core/src/shield/l10n/<code>.ts` and `packages/content/src/l10n/<code>.ts`, then
   register them; the tests list anything missing.
4. Add guided-mode copy in `packages/ai/src/offline.ts`, crisis copy in `packages/core/src/crisis`
   and follow-up copy in `packages/api/src/jobs`.
5. Have native speakers review everything, safety copy first, then flip the status to
   `complete`.
