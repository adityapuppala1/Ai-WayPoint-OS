# Privacy

Principles: collect little, explain everything, nothing optional on by default, and make
leaving easy.

## Consent

Purpose-specific and revocable (`consents` table, full history in `consent_events`):
`personalization`, `foresight_matching`, `memory`, `ai_external`, `circle_matching`,
`trusted_contact`, `org_aggregates`, `research_aggregates`. All start **off**.

## Encryption

- Envelope encryption (`packages/core/src/privacy`): each person has a random 256-bit data
  key (DEK), wrapped by the server key-encryption key `WAYPOINT_KEK` (AES-256-GCM, key id
  prefixed so keys can rotate with `WAYPOINT_KEK_PREVIOUS`).
- Encrypted fields: journal entries, mood and health notes, health reminder titles, goal titles
  and reasons, weekly reviews, trusted contacts, money snapshot, sensitive memories, messaging
  addresses. Associated data binds each ciphertext to its table, owner and row, so it cannot
  be moved elsewhere.
- What stays readable, and why: mood scores (1–5) and tags for the two-week trend, goal area,
  dates and progress for Today, the money currency, health numbers (hours of sleep, minutes of
  movement, glasses of water) for the weekly view, and when a reminder is next due. A due
  reminder's note on Today is generic; the words are decrypted only when the owner views it.
  Today shows the money pressure level and runway only — never amounts.
- Journal entries, check-in notes and health notes are screened for signs of danger as they are saved (the
  same deterministic rules as Ask). If something is flagged, the support card appears straight
  away and a safety record is kept — tier and rule ids only, never the words.
- Deleting an account deletes the wrapped key first (crypto-shredding), then every row.

## Circles

- Circle posts are visible to the members of that circle only, under the name the person chose
  for it (never the account name or email). Posts are stored in the clear so members can read
  them, which is why personal details are masked before a post is saved.
- Suggestions based on your situation need `circle_matching` consent; browsing works without it.
- Leaving a circle can delete everything you posted there. Deleting your account deletes all
  your circle posts (and replies to them) and frees your seats.

## What leaves Waypoint

- Only with `ai_external` consent (or a one-off tick in Shield): text sent to an AI provider
  is **redacted first**: email addresses, phone numbers, card numbers (Luhn-checked), IBANs,
  Aadhaar, PAN, SSN, BVN and passport numbers, UPI handles and IP addresses. Names are not
  removed automatically, so the app reminds people not to share them.
- A self-hosted model (`OLLAMA_BASE_URL`) keeps everything on your servers.
- Surroundings fetches weather and air quality from the browser directly (Open-Meteo), with
  coordinates rounded to about 1 km. The chosen place and the last forecast are kept in the
  browser's local storage only, so Waypoint's servers never see a location.

## What is never stored

- Text pasted into Scam Shield (only a hash, the verdict, the rule ids and the host names of any
  links in it, such as `example.top`, to spot scams going round).
- The words that triggered a crisis response.
- Raw IP addresses (only keyed hashes for rate limiting and audit).

## Organisations

Employers, schools, NGOs, public services and community groups can run **programmes** (a
reskilling cohort, a school leavers' year) that people join with a code, link or QR code.

- **Joining is not being counted.** The join page explains exactly what the organisation will
  and will never see; being counted is a separate choice for **that programme only**, always
  unticked to begin with. Choosing it is recorded with the enrolment (and turns on the
  account-wide `org_aggregates` consent, in the same transaction and before the enrolment it
  covers). Each programme can be switched on or off in Privacy settings; switching
  `org_aggregates` off stops every programme counting the person and resets each programme's
  choice to off, so switching it back on never quietly restores an old choice. Agreeing for one
  programme never counts anyone in another. When a guest's data moves into an account, the
  account's own choice wins: if it does not allow counting, no programme choice carried over
  from the guest counts either.
- **Who is counted:** people who chose it for the programme at least **7 days** earlier (switching
  it on later starts the week then) and still allow organisations to count them. Accounts made
  to single someone out (join, look, compare) make no difference for a week — and neither does
  anyone else.
- **Weekly totals.** A programme's raw totals are taken once a week (the first time anyone looks
  that week) and served unchanged until the next Monday. Comparing two views can never show one
  person joining, leaving or changing their mind. Leaving, or switching counting off, takes
  effect in the next weekly totals. Old weekly totals are deleted after 26 weeks.
- **What an organisation sees:** for each programme, and only when at least **k** people are
  counted (`WAYPOINT_K_ANON_MIN`, default 50, never below 20):
  - how many people are counted, **rounded down to a multiple of 5**;
  - shares with an active plan, who finished a plan step in the last 30 days, and who are working
    towards the programme's target roles — **rounded to 5 points**, and shown only when **both**
    the people a share describes and everyone else are groups of at least k (a few people, or a
    few accounts made for the purpose, can never single someone out);
  - the roles people are aiming for and the skills they are building, as groups of at least k
    with **complementary suppression** (small groups are hidden, and more are hidden if the
    hidden ones could be worked out by subtraction), listed in order of the rounded numbers
    shown, never of the exact counts behind them.
- **A margin nobody outside the server knows:** on top of k, each number needs 0–4 more people
  before it appears (fixed per programme, metric and week from a keyed hash). Watching a number
  appear does not reveal the moment the k-th person joined.
- **Noise:** every number shown carries a little Laplace noise from a keyed hash of the programme,
  the metric and the true number itself: a number that does not change keeps the same noise for
  good, so collecting weeks of figures cannot average it away, while any change draws fresh
  noise. Which numbers are shown is decided on the true counts plus the margin, so noise never
  reveals a group smaller than k.
- **The threshold only goes up.** An organisation can raise its k (never above 1000) but never
  lower it again: stepping it down and up would reveal exact group sizes. Changes to details and
  programmes are rate-limited.
- **Target roles can change**, but the share working towards them is then hidden until the next
  weekly totals — changing them mid-week is not a way to look again.
- **What an organisation never sees:** who joined, names, emails, anything a person wrote, and
  anything from Mind, Health, Money, Circles, Ask or Shield — those are never read to compute
  totals. Below k, nothing but "fewer than k" is shown.
- **The team:** organisation staff (owner, admin, member) see each other's names and emails.
  Invitations are only sent from, and only answered by, **confirmed email addresses** (the link
  alone is not enough: it may have been passed on). Each address receives at most 3 invitation
  emails a day, and each organisation sends at most 50. Staff actions — programmes created, codes
  replaced, invitations, role changes — are written to the audit log. What people do for
  themselves (joining, exporting their data) is never audited.
- **When an owner deletes their account**, organisations they alone own pass to the
  longest-standing **admin** — never to a read-only member — or are deleted when there is no
  admin; the delete-account dialog lists those first. The audit log keeps what happened but no
  longer who the deleted person was (actor, target and address hash are cleared). People in its
  programmes keep all of their own data either way.
- Known limit: these rules make singling someone out slow and expensive — an organisation would
  need k accounts per programme, each waiting a week, and could look only once a week — but not
  impossible for a determined organisation. Keep k high for small or sensitive programmes.

## Accounts, sessions and messages

- **Email addresses are confirmed before first sign-in**, with a link that works for 24 hours.
  Opening it confirms the address and nothing more — it never signs anyone in. Signing in before
  confirming sends a fresh link (only whoever knows the password can ask for one), and a
  password reset counts as confirmation because the link went to that address. An account that
  is never confirmed is deleted after 7 days (`UNCONFIRMED_ACCOUNT_DAYS`); nobody can have
  signed in to it.
- **Nobody can find out who uses Waypoint by trying addresses.** Creating an account answers
  exactly the same — status, body, no cookie — whether the address is new or already has an
  account. The owner of an existing account gets a "you already have an account" email instead,
  at most once a day however often someone tries. Sign-in failures and password-reset requests
  answer the same for every address too.
- **What a guest did moves only where it should.** It moves into the account created from that
  guest session, the first time that account is signed in to on the same device. Signing in to
  any other account there brings it along only if the person ticks "Bring what I did as a guest
  into this account"; otherwise it is deleted (its data key first, then its circle posts with
  their replies), because on a shared device the guest may have been someone else.
- **Sessions keep no IP address.** Where an address matters (rate limits, the audit log) only a
  keyed hash is used; IPv6 addresses count as their /64 network.
- **Messages waiting to be sent** (emails, SMS, WhatsApp) keep the recipient encrypted, and what
  must not sit readable — a sign-in link or code, the words of a reply — sealed too. Once a
  message is sent, dropped or given up on, only its kind is kept ("verify-email", "text"), and the
  row is deleted after 7 days (30 if it could not be sent). Delivery errors are stored and shown
  without addresses or numbers. Codes and links are dropped rather than sent late.
- **Texting Waypoint** (SMS, WhatsApp, USSD): nothing anyone writes is stored, nor the replies.
  The phone number is kept sealed and found by a keyed hash, with the language, country and
  choices (STOP, AI answers) — and forgotten after 180 days without a message unless it is linked
  to an account. Staff see daily counts only. Messages go to an external AI only after the person
  texts `AI YES`, redacted first. Details: [CHANNELS.md](CHANNELS.md).
- **Logs** never carry what a failed database statement contained, one-time links, email
  addresses or phone numbers.
- **Phone numbers** are only ever added by proving them with a code, and **names** (which appear
  in invitations other people receive) are one line of at most 80 characters, without links.

## The phone app

The session cookie is kept in the phone's secure keystore; language, appearance, country and
the last "reach us by text" numbers in the app's own storage. Nothing typed into Scam Shield
is stored or sent unless the person asks for a second opinion online. The app asks for no
permissions (calls and texts open the phone's own apps), and accounts can be deleted from the
app itself. See [MOBILE.md](MOBILE.md).

## The public notice and terms

The website has a plain-language **privacy notice** (`/privacy`) and **terms of use** (`/terms`)
in all seven languages, linked from every public page, sign-up, getting started, Settings and
the phone app (More → About). They describe what the code does, and are written from this
document: change them together.

- **This installation, not a template.** Who runs it and how to reach them come from
  `WAYPOINT_OPERATOR` and `WAYPOINT_CONTACT_EMAIL` (a production server warns at start when either
  is missing, and the pages say plainly that the details haven't been added). Where the data
  lives (`WAYPOINT_DATA_LOCATION`) and how long backups are kept (`WAYPOINT_BACKUP_DAYS`) are
  shown when set. The outside services named — AI providers, texting and email services — are
  read from the configuration (`packages/api/src/services/legal.ts`), so the notice never names
  a service that isn't used or leaves out one that is; only host names are shown, never keys or
  passwords.
- **Versions.** `packages/core/src/legal.ts` holds the "last updated" dates and
  `PRIVACY_POLICY_VERSION`, which every consent records. Change the version when the notice
  changes what Waypoint does with information.
- **Minimum age** 13 (`MINIMUM_AGE`), or older where local law says so; help lines and scam
  checks need no account at any age.
- **Before launch**, have both reviewed by a lawyer for each country you serve: registration
  with a data protection authority, a representative in the EU or UK, and the age of digital
  consent can all apply, and the governing-law clause names the operator's country.

## Your rights, built in

- **Export**: Settings → Privacy → Download my data (complete JSON, decrypted for you).
- **Delete**: Settings → Privacy → Delete my account (immediate and permanent).
- **Retention**: choose how long conversations are kept (7 days to forever); idle guest
  accounts are removed after 180 days, and accounts whose address is never confirmed after 7.
