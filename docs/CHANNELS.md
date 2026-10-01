# Texting Waypoint: SMS, WhatsApp, USSD — and email

Many of the people Waypoint is for have a basic phone, little data, or both. They can reach
Waypoint by text: help lines for their country, scam checks, and short answers to questions.
The same rules that protect people on the web apply here — safety first, no AI without consent,
nothing they write kept.

Everything in this document is optional. With no provider set up, Waypoint works on the web as
before, the `/text` page says texting isn't available yet, and nothing is sent anywhere.

---

## What people can text

Words work in all seven languages, in capitals or not (`HELP`, `AYUDA`, `MSAADA`, `मदद`,
`مساعدة`…). `START` and `STOP` stay in English as well because carriers act on them.

| Text | Reply |
| --- | --- |
| `HELLO` / `MENU` (or hola, bonjour, habari, नमस्ते, مرحبا…) | What Waypoint can do, in a few lines |
| `HELP` | Help lines for their country, emergency number first |
| `CHECK` + a message, or just forward the message | Scam Shield verdict: risk, what to do, the signs, where to report |
| Any question | A short answer (see *AI answers* below) |
| `LANG 3` | Change language (1 English, 2 हिन्दी, 3 Español, 4 Français, 5 Português, 6 العربية, 7 Kiswahili) |
| `COUNTRY KE` | Set the country (two letters) for local numbers |
| `AI YES` / `AI NO` | Allow or stop fuller answers from the AI assistant |
| `STOP` / `START` | No more texts / come back |

The country is guessed from the phone number (+254 → Kenya) until the person sets it.

**Safety comes first.** Every message a person writes themselves goes through the crisis
classifier before anything else — even after `STOP`, because they wrote to us. Someone in
danger gets the emergency number and crisis lines straight away, in their language, without AI.
Only the fact that a crisis reply was sent is recorded (tier, rule ids, language, country) —
never the words.

**USSD** (`*384*1234#` style codes, Africa's Talking) is a menu of one-screen pages
(≤ 182 characters): help lines, check a message, language. Only the chosen language and country
are remembered for the number.

### AI answers

Questions are answered by the AI assistant only when one of these is true:

- the person texted `AI YES` — their message then goes to the configured AI provider with phone
  numbers, email addresses, card, bank and ID numbers removed first (names are not removed
  automatically), and every answer starts with `AI:`; or
- a **local** model is configured (`OLLAMA_BASE_URL`), which never leaves your servers.

Otherwise the reply points to what texting can do (help lines, scam checks) and to the website.

### What is answered, and what it can cost

Replies cost money, so they are bounded — never at the expense of someone in danger:

- **Countries.** Only numbers from countries Waypoint has help lines for get replies (or your
  own list in `WAYPOINT_TEXT_COUNTRIES`, e.g. `KE,TZ,UG`). Other numbers are neither recorded
  nor answered — except a message showing clear danger, which gets the support card. Set your
  provider's geographic permissions to the same countries: that is the real limit on where
  paid messages can go.
- **A ceiling for the whole service**: `WAYPOINT_TEXT_REPLIES_PER_HOUR` (default 2000) and
  `WAYPOINT_TEXT_REPLIES_PER_DAY` (default 20000). Beyond it nothing is sent until the hour or
  day turns over (the log says so once an hour). Crisis replies have a separate allowance of
  the same size, which ordinary messages cannot use up.
- **Per number**: 30 messages an hour and 200 a day, then one "please slow down" and silence.
  Someone in danger is still answered (5 support cards an hour past the limit).
- **Once per message.** Providers redeliver when an answer is slow, and a signed request can be
  replayed: a message id (`MessageSid`, WhatsApp's `wamid`, Africa's Talking's `id`) is
  answered once. Only a keyed hash of the id is kept, for a day.
- **Only what a person wrote.** WhatsApp reactions, "changed number" notices and delivery
  reports get no reply; voice notes and pictures get "here is what I can read".
AI answers are limited to 20 a day per number and are sent a moment after the reply, never
instead of it.

### Length and cost

Replies are written for basic phones: short, plain punctuation, and Latin-script languages kept
in the cheaper SMS alphabet (GSM-7 — 160 characters a part instead of 70), trading the few
accents it lacks for plain letters as people do when they text. Replies are cut to 3 parts
(5 for help lines, crisis replies and scam verdicts), with the most useful line first. WhatsApp
replies can be longer.

Each number can send 30 messages an hour and 200 a day; past that it gets one "please wait"
reply an hour, then silence, because every reply costs the sender.

---

## What is kept

| Kept | How long |
| --- | --- |
| The phone number, **sealed** (encrypted with the server key) and looked up by a keyed hash | 180 days after the last message, unless linked to an account |
| Language, country, whether they allowed AI answers, whether they texted STOP | Same |
| That a crisis reply was sent (tier, rule ids, language, country — no words) | As for crisis events from the web |
| Daily counts by channel, direction and kind (e.g. "SMS · in · help · 41") | 13 months |
| A message waiting to be sent: the recipient and the words are both sealed | Until sent; afterwards only its kind is kept, and the row goes after 7 days (30 if it failed) |

Never kept: what anyone texted, the replies, AI answers, sign-in codes or links once sent.

---

## Setting up a provider

Any one provider is enough; they can be combined (for example Africa's Talking for SMS and USSD
in East Africa, the WhatsApp Cloud API for WhatsApp everywhere). Set the variables in
`.env.local` (development) or your host's secret store, restart, and point the provider's
webhook at the addresses below. Replace `https://waypoint.example` with your `WAYPOINT_URL` —
it must be the public HTTPS address people use, because Twilio signs the exact URL it calls.

| Provider | Channel | Webhook (method) | Verified by |
| --- | --- | --- | --- |
| Twilio | SMS | `https://waypoint.example/api/channels/twilio/sms` (POST) | `X-Twilio-Signature` (HMAC-SHA1 with the auth token) |
| Twilio | WhatsApp | `https://waypoint.example/api/channels/twilio/whatsapp` (POST) | `X-Twilio-Signature` |
| Meta | WhatsApp Cloud API | `https://waypoint.example/api/channels/whatsapp` (GET to verify, POST for messages) | `X-Hub-Signature-256` (HMAC-SHA256 with the app secret); verify token for the GET |
| Africa's Talking | SMS | `https://waypoint.example/api/channels/africastalking/sms?key=…` (POST) | the `key` in the address |
| Africa's Talking | USSD | `https://waypoint.example/api/channels/africastalking/ussd?key=…` (POST) | the `key` in the address |

A webhook that isn't configured answers `404`; one whose signature or key is wrong answers
`403` before anything is read. These addresses are left out of the public API document.

### Twilio (SMS and WhatsApp)

```
TWILIO_ACCOUNT_SID=AC…
TWILIO_AUTH_TOKEN=…
TWILIO_SMS_FROM=+15550001234          # or TWILIO_MESSAGING_SERVICE_SID=MG…
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WAYPOINT_SMS_NUMBER=+1 555 000 1234  # shown on the website
WAYPOINT_WHATSAPP_NUMBER=+1 415 523 8886
```

In the Twilio console, set the number's *A message comes in* webhook to the SMS address (and
the WhatsApp sender's to the WhatsApp address). Replies go back in the webhook answer (TwiML).

### WhatsApp Cloud API (Meta)

```
WHATSAPP_VERIFY_TOKEN=<a long random value you choose>
WHATSAPP_APP_SECRET=<App settings → Basic → App secret>
WHATSAPP_ACCESS_TOKEN=<a permanent system-user token>
WHATSAPP_PHONE_NUMBER_ID=<from WhatsApp → API setup>
WAYPOINT_WHATSAPP_NUMBER=+254 700 000 000
```

In *WhatsApp → Configuration*, set the callback URL and the same verify token, and subscribe
to `messages`. Replies are sent through the Graph API as free-form text, which WhatsApp allows
within 24 hours of the person's last message — Waypoint only ever replies, so it stays inside
that window (queued replies older than a day are dropped rather than sent late).

### Africa's Talking (SMS and USSD)

```
AFRICASTALKING_USERNAME=sandbox       # your app's username in production
AFRICASTALKING_API_KEY=…
AFRICASTALKING_SENDER_ID=             # optional, once approved
AFRICASTALKING_WEBHOOK_KEY=<at least 32 random characters>
WAYPOINT_SMS_NUMBER=22384             # a short code is fine
WAYPOINT_USSD_CODE=*384*1234#
```

Africa's Talking doesn't sign callbacks, so the callback addresses carry
`?key=<AFRICASTALKING_WEBHOOK_KEY>`: keep it long, random and secret, and change it if it
leaks. Set the SMS callback under *SMS → Callback URLs → Incoming messages* and the USSD one on
the service code.

### Rules you must follow as the sender

Messaging is regulated, and the rules change; check your provider's current guidance before
launch. In particular:

- **United States** — long-code SMS needs A2P 10DLC brand and campaign registration (or a
  verified toll-free number).
- **India** — commercial SMS, including sign-in codes, must use DLT-registered sender IDs and
  templates.
- **Kenya, Tanzania and others** — alphanumeric sender IDs and short codes are registered with
  each network, usually through your provider.
- **WhatsApp** — the number needs a verified business profile, and messages must follow
  WhatsApp's commerce and business policies.

Waypoint honours `STOP` (and the carrier-standard words: STOPALL, UNSUBSCRIBE, CANCEL, END,
QUIT) on every channel and never starts a conversation: it only replies.

---

## Sign-in codes by SMS

Phone sign-in (`/api/auth/phone-number/send-otp`) sends a six-digit code through the SMS
provider, in the language of the page it was requested from, and states that Waypoint never
asks for it. A code that can't be sent within five minutes is dropped instead of arriving late.

---

## Email

Confirmation links, password resets and organisation invitations are sent through either:

```
EMAIL_FROM="Waypoint <hello@waypoint.example>"
RESEND_API_KEY=re_…                                   # https://resend.com
# or
SMTP_URL=smtp://user:password@smtp.example.org:587    # any SMTP server
```

Every email comes as plain text and simple, accessible HTML in the reader's language (right to
left in Arabic), with one button and the link written out, and a footer saying Waypoint never
asks for passwords, codes or payments by email. Set up SPF, DKIM and DMARC for the sending
domain with your provider, or mail will land in spam.

Without a provider, development prints each email and text in the terminal running `pnpm dev`
(`outbox (development: not sent)` — open the `url`); production marks them failed, and the
admin console shows how many.

---

## Sending, retries and monitoring

Messages go through the outbox: written in the same transaction as the change that caused them,
then sent by the background worker every minute (and straight away after a text comes in).
A failed send is retried with growing gaps (2, 4, 8… minutes) up to six times; provider errors
are stored with any address or number removed. Messages that are no longer useful are dropped
instead of sent late: sign-in codes after 5 minutes, password resets after an hour, confirmation
links after a day, invitations after a week, text replies after a day.

**Admin → Overview → Texts** shows, for the last 30 days and as counts only: which channels are
set up, messages in and out per channel, how many numbers wrote, what people wrote about
(safety, help lines, scam checks, questions, settings), AI answers and sign-in codes sent.

---

## Trying it locally

1. Put the provider's variables in `.env.local` and run `pnpm dev`.
2. Expose your machine with a tunnel (for example `cloudflared tunnel --url http://localhost:3000`),
   set `WAYPOINT_URL` to the tunnel's HTTPS address, and restart.
3. Enter the webhook addresses above in the provider's console, with that address.
4. Text the number. Africa's Talking's sandbox has a phone simulator for SMS and USSD.

The automated tests (`packages/api/test/channels.test.ts`) cover every webhook with real
signatures, a stand-in for the providers' APIs, STOP handling, sealed and expiring messages,
retention and the admin counts.
