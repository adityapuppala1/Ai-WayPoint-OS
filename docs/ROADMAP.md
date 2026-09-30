# Roadmap

## Now (this version)

Today, onboarding, Path (skills, roles, plans), Scam Shield, Ask (AI + guided mode), Get help
now, crisis protocol with follow-ups, Services checklists, Signals, Settings & Privacy
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
7. **Signals & forecasts** — ingestion worker, forecasts with a public accuracy scoreboard.
8. **Organisation console** — done: organisations with teams and roles, programmes with join
   codes, links, QR codes and printable posters, k-anonymous insights (rounded, noisy, small
   groups suppressed), audit log. **Admin console** — done: moderation queue for Circles, scam
   report review that feeds Shield, AI spend, delivery and lifeline freshness. Still to do:
   billing for paid plans, CSV export of totals, and single sign-on for large organisations.
9. **Proof of work** — projects, peer review and verifiable credentials (signing is built).
10. **SMS / WhatsApp / USSD** — done: help lines, scam checks and answers by text through
    Twilio, the WhatsApp Cloud API or Africa's Talking, with email through Resend or SMTP.
    Still to do: WhatsApp message templates for reminders the person asked for, and voice (IVR)
    for people who can't read.
11. **Phone app** (Expo, iOS and Android) — done: Today, Scam Shield on the phone in every
    language, Ask with the support card and approvals, help lines offline, accounts and privacy
    choices. Still to do: signed-in website pages inside the app, push notifications for
    reminders and follow-ups, an app lock for shared phones, and native Money, Goals and Mind
    ([MOBILE.md](MOBILE.md)).
12. **Deployment** — Docker, Kubernetes manifests, CI.

## Before public launch

Clinical and legal review of crisis flows per country, legal review of the privacy notice and
terms for each country served (with any data protection registration they need), help-line
verification with each service, security review and penetration test, load testing,
accessibility audit with assistive-technology users, and a pilot with a partner organisation.
