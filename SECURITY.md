# Security

Waypoint is used by people in hard moments, so a security problem here can hurt someone.
Thank you for telling us before telling anyone else.

## Reporting a problem

**In the Waypoint software** (this repository): open a private report at
<https://github.com/adityapuppala1/Ai-WayPoint-OS/security/advisories/new>. Only the
maintainers can see it. Please do not open a public issue or pull request for a vulnerability.

**In a running Waypoint** (someone's installation): write to the people who run it. Every
installation serves `/.well-known/security.txt` with their contact (set with
`WAYPOINT_SECURITY_CONTACT`, or `WAYPOINT_CONTACT_EMAIL`). If the problem is in the software
rather than in how they set it up, please report it here as well.

A useful report says:

- what you found and where (address, endpoint or file);
- the steps to see it, as exactly as you can;
- what someone could do with it;
- the version or commit, if you know it.

Please do not include other people's personal information. If you came across any while
testing, say that you did, but not what it was.

## What to expect

- We aim to answer within 5 working days, and to tell you whether we can reproduce the
  problem within 10.
- We will keep you informed while we fix it, and tell you when the fix is released.
- We will credit you in the release notes if you would like that.
- There is no bug bounty.

## Testing in good faith

We will not take action against anyone who looks for problems in good faith. That means:

- test on your own installation where you can (`pnpm dev` runs everything on your machine);
- on someone else's installation, use only accounts you created, and stop as soon as you
  have shown the problem;
- never read, change or delete other people's information;
- never send texts or emails to people who did not ask for them, and do not flood the
  service (denial of service is out of scope);
- give us reasonable time to fix the problem before you publish it.

## In scope

- The web app, the API (`/api/*`), accounts and sessions, and the background worker.
- The phone app (`apps/mobile`) and the SMS, WhatsApp and USSD channels.
- Privacy promises in [docs/PRIVACY.md](docs/PRIVACY.md) and safety promises in
  [docs/SAFETY.md](docs/SAFETY.md): anything that breaks one of them is a security problem
  to us, even when no code is "broken". Examples: a way for an organisation to learn about one
  person, a way to read a post held for its writer's safety, a way to make the assistant save
  something without the person's yes.
- The deployment files in `infra/`.

Out of scope: problems that need a device that is already compromised, missing best-practice
headers with no demonstrated effect, denial of service by volume, and the third-party services
an operator connects (report those to their providers).

## What runs automatically

On every pull request and every push to `main` (`.github/workflows/ci.yml`):

- lint and formatting, type checks and the unit tests of every package;
- the **security regression tests** (`packages/api/test/security.test.ts`): each finding from a
  security review has a test that reproduces it and fails without its fix;
- the **safety evaluations** (`pnpm eval`): the crisis and scam classifiers against their
  release gates, and the assistant's guardrails against a scripted model;
- the phone app bundle and the production build.

On every change and once a week (`.github/workflows/security.yml`):

- `pnpm audit --prod`: a high or critical advisory in a production dependency fails the run;
- gitleaks over the whole history: no secret may ever have been committed;
- CodeQL code analysis with the extended security queries.

Dependency updates arrive as pull requests (`.github/dependabot.yml`) and go in only once
everything above passes on them. pnpm also refuses packages published in the last day.

The security tests normally run against the embedded database, which answers one request at
a time. Races between requests only show against a real Postgres: before a release, run them
there too (`WAYPOINT_TEST_DATABASE_URL=postgres://… pnpm --filter @waypoint/api test`).

## Known limits

Stated plainly, so nobody has to find them out:

- **Signing in.** The same answer is given for a wrong password, an unknown address and an
  unconfirmed address. After 20 tries in 15 minutes an account is held back for devices that
  have never signed in to it; a device that has signed in before is not affected.
- **Confirming an address nobody asked for.** Someone can create an account with another
  person's address. It cannot be signed in to unless that person opens the confirmation link,
  which says to ignore the email if they did not ask for it; unconfirmed accounts are deleted
  after 7 days.
- **Sign-in codes by text.** A number receives at most 3 codes an hour and 6 a day, so
  someone who knows a number can use that allowance up. Email and password still work.
- **Africa's Talking callbacks** are not signed by the provider: the secret in the callback
  address is all that proves where they came from. Keep it out of proxy logs and rotate it if
  it may have been seen.
- **Ask conversations** are stored readable on the server (see PRIVACY.md), unlike journals,
  goals and memories, which are sealed with each person's own key.
- **Organisations and small groups.** The rules in PRIVACY.md make singling someone out slow
  and expensive, not impossible. Keep the threshold high for small or sensitive programmes.

## For people who run Waypoint

The checklist for a production installation is in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#before-you-go-live). The short version: strong secrets
that you can rotate, https only, the app never reachable except through your proxy, the worker
running, database backups and TLS, spending limits with your AI and texting providers, and
`WAYPOINT_OPERATOR`, `WAYPOINT_CONTACT_EMAIL` and `WAYPOINT_SECURITY_CONTACT` set so people know
who you are and how to reach you.
