# Safety

Waypoint talks with people during hard moments. Safety features are deterministic, work
without AI, run before any AI call, and are covered by tests and release-gated evaluations.

## Crisis protocol

- **Detection** (`packages/core/src/crisis`): a multilingual rule classifier (English, Hindi,
  Spanish, French, Portuguese, Arabic, Swahili, plus common romanised forms) assigns a tier:
  0 none · 1 distress · 2 self-harm or suicidal thoughts · 3 imminent danger or medical
  emergency. It handles negation, idioms ("I'm dying to see that film"), talk about other
  people, obfuscated spellings, and plans + timelines + means.
- **Response** (`planCrisisResponse`): a short, warm message in the person's language and
  concrete actions with **verified local numbers** (call, text, chat), grounding, a trusted
  contact, and staying in the conversation. Tier 3 and medical emergencies show emergency
  help and **suppress the AI reply**. Tier 2 switches Ask to safe mode (short, careful turns).
- **Colour and tone**: a calm "harbour blue" support card — never alarm red.
- **Records**: a crisis event stores the tier, categories and rule ids — never the words.
  A gentle follow-up check-in is scheduled (12–24 h) and delivered in-app.
- **Trusted contacts** are only ever contacted when the person presses the button.
- **By text message too, whatever the first word.** On SMS and WhatsApp the crisis check runs
  on every message before anything else: "hi im suicidal" is not answered with the menu, and a
  command word in front of a cry for help does not hide it. A message sent with CHECK is mostly
  someone else's words, so there only clear danger (tier 2+) puts the support card first, with
  the scam warning after it. A number over its hourly limit — or one somebody else flooded —
  still gets the support card, from a small allowance of its own, and so does a number from a
  country Waypoint does not otherwise serve. STOP never takes the place of help: "end my life"
  is a sentence, not an opt-out.
- **The check-in afterwards is safety-critical**: the daily limit on messages never holds it
  back (someone who asked for no other messages still gets it). It waits for quiet hours to end.
- **No connection, same help.** The phone app has the classifier, the response plans and the
  help-line data built in: if a message can't reach the server, the support card with local
  numbers still appears, and Get help now works fully offline.

## Help-line data

Every number in `packages/content/src/support.ts` and `emergency.ts` was checked against an
official or primary source; the source URL and date are stored with it and shown in the UI.
Countries without a verified national line fall back to global directories (Find a Helpline,
Befrienders Worldwide, Child Helpline International). Never add a number without a source.

**Which country's numbers.** The country the person chose; if they skipped that question, the
country their device's time zone belongs to (Africa/Nairobi → Kenya, from the tz database in
`packages/content/src/time-zones.ts`, including old names browsers still report such as
Asia/Calcutta). That is also where local emergency numbers work when someone is travelling. On
public pages the edge's country header (Cloudflare and similar) comes first. Getting started
shows the guess as a starting point to change, and the crisis card, Today's emergency line and
the help in Mind, Health and Circles all use the same rule (`helpCountry`).

## Scam Shield

Rules first (pressure, payment, credential requests, lookalike links, shorteners, channel
switching, impersonation, country-specific patterns such as "digital arrest" and loan apps),
then an optional AI second opinion on a redacted copy that can **only raise** the level.
Nothing pasted is stored — only a hash, the verdict and the rule ids.

- **Every language, not just English.** Each rule carries cues in English, Hindi (Devanagari
  and romanised), Spanish, French, Portuguese, Arabic and Swahili, and the golden set has at
  least 15 scams and 7 everyday messages per language. The tests hold each language to the same
  bar: ≥ 90 % of scams rated high, no everyday message rated high.
- **Spelling variants match.** Text and patterns are folded the same way: Latin accents,
  Arabic vowel marks and hamza seats (أ إ آ ؤ ئ), ى/ي and ة/ه, and Hindi nukta and
  chandrabindu (ज़/ज, हाँ/हां) — so a message matches however it was typed. The same folding
  applies to the crisis lexicon; before it, Arabic phrases for self-harm and overdose written
  with a hamza seat could be missed.
- **Links.** A link to a known official site (including global brands' country sites such as
  amazon.es) is not a warning sign; a delivery problem that comes with any other link is.
- The same engine answers scam checks by SMS, WhatsApp and USSD ([CHANNELS.md](CHANNELS.md)),
  and runs inside the phone app, where a check never leaves the phone unless the person asks
  for a second opinion ([MOBILE.md](MOBILE.md)).
- **Word edges in every script.** `\b` only knows ASCII letters, so patterns use a Unicode
  word edge built for the scripts people write in (`core/src/text/boundary.ts`), in the
  cheapest form that means the same thing where it stands — a test checks every pattern matches
  exactly as the full Unicode edge would.

## Health and Surroundings

- **No diagnosis.** Health is a log, reminders and "where to get care". Health notes are screened
  for signs of danger like any other writing.
- **Emergency signs** (stroke, heart attack, severe allergic reaction, heatstroke) follow NHS
  guidance, with sources shown under them, and point to the verified emergency number.
- **Non-emergency lines** follow the same rule as help lines: only services checked against an
  official source (`packages/content/src/health.ts`). Elsewhere the page suggests a pharmacist
  or local clinic rather than a number.
- **Weather advice** uses published thresholds: NWS heat index bands on the "feels like"
  temperature, NWS wind chill (skin can freeze in 30 minutes at −28 °C), US EPA air quality
  categories, WHO UV advice, and gale-force gusts (62 km/h+). Advice is general and phrased as
  what to do, never as a forecast guarantee.

## Circles (peer groups)

Peers are not crisis responders, and a group of people who just lost work is a favourite target
for fake job offers. Every post and reply is checked on the server before anyone else sees it
(`moderatePost` in `packages/core/src/community`), with no AI involved:

- **Signs of danger** (crisis tier ≥ 2): the post is **held** — only its author sees it, marked
  "Only you can see this" — and the author gets the support card straight away. A safety record
  is kept (tier and rule ids only) and the usual gentle follow-up is scheduled.
- **Likely scams** (Shield high or very high): held for a moderator (see Moderation below); the
  author is told why.
- **Personal details** — phone numbers, emails, card, bank, ID and payment numbers — are
  masked before the post is stored, so nobody is contacted or defrauded off-platform.
- **Identity**: people appear by a name they choose for that circle, or "Member 1234" (a number
  that differs in every circle, so people can't be followed between circles). Names with contact
  details are refused. Account names and emails are never shown.
- **Reports** are anonymous. Three reports from three different people hide a post until it is
  reviewed (one person reporting three times counts once, however the reports arrive).
  "I'm worried about this person" sends the author a gentle, anonymous note pointing to support
  (at most one a day; it never says who asked or which post).
- **Small by design**: 12 people per circle, up to five circles each; joining a full circle
  opens a sibling on the same topic and language. Joining needs an account and agreeing to the
  guidelines. Leaving can take your posts with you; deleting your account always does.

## Moderation (admin console)

Platform staff (accounts with the `admin` role; create one with `WAYPOINT_ADMIN_EMAIL`) review
Circles at **/admin/moderation**:

- The queue holds posts **held as likely scams**, posts **hidden after three reports**, and
  visible posts with open reports. Reasons are shown as counts ("Unkind or harassing: 2").
- Posts **held because the writer may be in danger are never shown** to moderators — only
  counted. The writer already had the support card and a follow-up; a moderator reading their
  words would add exposure, not safety.
- **Keep** makes the post visible and closes its reports; **Remove** deletes it with its replies —
  except a reply held because its writer may be in danger, which stays, visible to its writer
  only.
  Either way the writer gets a short note in their language (removal says it broke the
  guidelines). "Worried about this person" reports are about the writer, not the post, and the
  queue says so.
- Every decision is written to the audit log (who, what, when), shown at /admin/audit.
- **Staff cannot act as someone else.** The auth library's own staff endpoints — impersonating
  a user, setting their password, listing or editing users — are switched off and refused before
  they reach it (whatever the spelling of the path), so nobody can read a crisis-held post, a
  journal or money notes by signing in as its writer. The same goes for the library's
  organisation endpoints and its self-service account and guest deletion (deletion goes through
  Waypoint, which also hands organisations over and removes circle posts). Its API reference
  page, which loads a script from a CDN, is switched off in production.
- The admin account from `WAYPOINT_ADMIN_EMAIL` is only promoted once that address is
  **confirmed**; an unconfirmed account with the same address (perhaps not the owner's) is left
  as it is, with a warning in the server log.
- Delivery errors shown on the overview have email addresses and phone numbers removed, and are
  stored that way too.

**Scam reports** that people send from Shield wait at /admin/reports. A reviewer can publish a
report — Shield then shows people in that country the scam type and the websites named, never
the description — reject it, or mark it reviewed. Similar reports (sharing a website or a hashed
phone number or payment id) are flagged together. Websites are shown as text, never as links.

The overview page also lists **lifelines to recheck**: any crisis line, emergency number, health
line or reporting channel whose source was last checked more than 180 days ago.

## Organisations

Programmes let an employer, school or NGO bring people to Waypoint, which raises two risks:
pressure ("my employer will see this") and surveillance. The console answers both by design —
see PRIVACY.md → Organisations. People join voluntarily, being counted is a separate, unticked
choice, and nothing from Mind, Health, Money, Circles, Ask or Shield is ever used in totals.

## AI boundaries

- System prompts forbid inventing phone numbers: the companion must use `find_support`.
- Tools that save anything (goals, memories, plans) require the person's approval, and
  approvals are HMAC-signed so a client cannot forge them. A yes is recorded once: the same
  answer arriving twice (two taps, a retry) saves nothing twice.
- The client sends only its newest message; the server owns conversation history, so earlier
  assistant turns cannot be rewritten.

## Evaluations

`pnpm eval` runs `evals/datasets/*.jsonl`. Release gates: crisis tier ≥ 2 recall ≥ 95 %,
zero hard negatives over their allowed tier, ≥ 90 % of scams rated high, ≤ 10 % of legitimate
messages rated high, and **every assistant guardrail case passes**. Add a case for every miss
found in review.

The guardrail cases (`guardrails.jsonl`) need no AI key. A scripted stand-in model plays a
model that misbehaves, and the cases check what Waypoint guarantees anyway: the support card
before any model in every language, nothing saved without a yes (and no way to forge, move or
replay one), nothing saved because a pasted message or a tool result said so, no personal
details sent to an outside model, and the rules on medical, legal and money advice and on
never claiming to know the future present in every prompt.

## Before launch in a new language or country

1. Native-speaker and clinical review of the crisis lexicon and copy.
2. Verify help-line numbers with the services themselves.
3. Extend the evaluation sets with local phrasing and scams: at least 15 scams and 7
   everyday messages, written without looking at the patterns, then fix what they miss.
