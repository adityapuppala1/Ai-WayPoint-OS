# Roadmap

## Now (this version)

Today, onboarding, Path (skills, roles, plans), Scam Shield, Ask (AI + guided mode), Get help
now, crisis protocol with follow-ups, Services checklists, Signals, What’s next? (forecasts
with a public record), Settings & Privacy
(consents, trusted contacts, export, delete), guest-first accounts, PWA + offline help page,
OpenAPI, background jobs, safety evaluations, and a plain-language privacy notice and terms of
use in every language, filled in from each installation's own configuration.

## Next

1. **Translations** — done for the interface, Scam Shield results, skill and role names and
   plans in हिन्दी, Español, Français, Português, العربية and Kiswahili (see LOCALIZATION.md).
   Still to do: human translation of long guidance, and native-speaker review of everything.
2. **Circles** — done: small peer groups (up to 12) in your language, circle names instead of
   account names, personal details masked, scams and crisis posts held, anonymous reports and
   "worried about this person" notes, and the moderator queue in the admin console.
3. **Money** — done: runway, pressure level, first steps, scam-safe money habits (encrypted).
4. **Mind** — done: encrypted journal, mood check-ins with a trend, breathing and grounding.
5. **Goals** — done: private goals with progress and the weekly review (streaks deliberately left out).
6. **Health** — done: daily log, weekly view, private reminders and where to get care
   (checked lines for GB, AU, NZ, DE, PT and IN so far; more countries need sourcing). **Surroundings** —
   done: weather, air and UV advice fetched by the browser from Open-Meteo, offline fallback.
7. **Signals & forecasts** — done: forecasts that staff publish and judge, each with its
   chance in a number and in words, sources, what to do and the day it is judged; a public
   record (time-weighted Brier score after 10 judged forecasts, calibration after 30); an
   edit screen for an open forecast's details and translations; a second check on every
   verdict (shown as "not yet double-checked" until a different member of staff confirms
   it). Signals can be saved or hidden ("Not relevant", with Undo), there is a Saved list,
   and staff add sourced signals by hand in the admin console and can withdraw them.
   Still to do: an ingestion worker for signals (today every signal is typed in by staff, so
   a country nobody covers sees none), a way for someone to say which sectors they work in
   (signals can be tagged with sectors, but no screen asks), reminders to staff when a
   forecast is due (the console shows a count), a way for the second person to disagree with
   a verdict (today they can only leave it unconfirmed), and forecasts in the phone app and
   by text.
8. **Organisation console** — done: organisations with teams and roles, programmes with join
   codes, links, QR codes and printable posters, k-anonymous insights (rounded, noisy, small
   groups suppressed), audit log. **Admin console** — done: moderation queue for Circles, scam
   report review that feeds Shield, AI spend, delivery and lifeline freshness, signals, and
   the feedback people send from Settings ("Tell us what worked, or what didn't"). Still to
   do: billing for paid plans, CSV export of totals, and single sign-on for large
   organisations.
9. **Proof of work** — projects, peer review and verifiable credentials (signing is built).
   Until the pages exist, plans promise no credential and link to no proof page; a test checks
   every link a plan can carry against the pages the app really has.
10. **SMS / WhatsApp / USSD** — done: help lines, scam checks and answers by text through
    Twilio, the WhatsApp Cloud API or Africa's Talking, with email through Resend or SMTP.
    Still to do: WhatsApp message templates for reminders the person asked for, and voice (IVR)
    for people who can't read.
11. **Phone app** (Expo, iOS and Android) — done: Today, Scam Shield on the phone in every
    language, Ask with the support card and approvals, help lines offline, accounts and privacy
    choices. Still to do: signed-in website pages inside the app, push notifications for
    reminders and follow-ups, an app lock for shared phones, and native Money, Goals and Mind
    ([MOBILE.md](MOBILE.md)).
12. **Deployment** — done: a Docker Compose stack behind a reverse proxy, Kubernetes
    manifests (probes, resources, autoscaling, disruption budget, worker, migration job), a
    repeatable load test with a recorded baseline, CI that runs the race tests on real
    Postgres and validates the manifests ([DEPLOYMENT.md](DEPLOYMENT.md)). Still to do: run
    the manifests in a real cluster, and a load test on production-sized hardware.
13. **Security and AI guardrails** — done: an internal security review with a test for every
    finding and an independent re-check, a reporting policy ([SECURITY.md](../SECURITY.md)) and
    `/.well-known/security.txt`, and guardrail evaluations that run without a model
    ([AI.md](AI.md)). Still to do: a penetration test by an outside firm.
14. **Typed second opinions (TypeSafe's Jev)** — done: an optional judge that can only add
    caution, in Scam Shield, on answers by text, on plan rewrites and in guided mode, with
    guardrail cases and a per-language measurement command
    ([AI.md](AI.md#typed-decisions-jev)). Still to do: run `eval:judge` with a real key, tune
    the thresholds (they are starting values) per language, and have TypeSafe's terms reviewed.

## Before public launch

Clinical and legal review of crisis flows per country, legal review of the privacy notice and
terms for each country served (with any data protection registration they need), help-line
verification with each service, a penetration test by an outside firm (the internal review is
done), a load test on the hardware you will run on (the baseline in `infra/load` is from one
laptop), accessibility audit with assistive-technology users, an editorial policy for who may
publish forecasts and signals, what the second person does when they disagree with a verdict,
and which sources are acceptable, and a pilot with a partner organisation.
