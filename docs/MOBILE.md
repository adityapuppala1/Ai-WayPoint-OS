# The phone app (iOS and Android)

The Waypoint app is the same product as the website, made for the phone people already carry:
help lines and scam checks that work with no connection, the next step for this week, and
someone to talk to. It is built with **Expo SDK 57** (React Native 0.86, the Hermes engine,
Expo Router) in `apps/mobile`, shares the domain logic, content, translations and design
tokens with the website, and talks to the same API.

---

## What is in the app

| Screen | What it does | Without a connection |
| --- | --- | --- |
| **Today** | The next step on the Sign (marking a plan step done flips it to the next), this week's route, notes for today, what changed for you, and the tools | Shows that you're offline; the tools below still work |
| **Shield** | Paste or type a message: the same rules as the website check it **on the phone**, in all seven languages, with the warning signs, what to do and where to report. "Get a second opinion online" re-checks it on Waypoint's server (not stored) and, where set up, with the AI check on a redacted copy. Report a scam without an account | The whole check works; the second opinion and reports need a connection |
| **Ask** | Talk it through. Replies stream in; the crisis check runs on the server before any AI call and shows the support card with local numbers; anything the assistant wants to save waits for **Allow**; earlier conversations can be opened or deleted | The crisis check runs on the phone and shows the same support card |
| **Help** | Emergency numbers for 48 countries, checked help lines for 47, and the global directories, with call, text and WhatsApp buttons; a breathing exercise; "reach us by text" numbers | Everything (the text-us numbers are the last ones seen) |
| **More** | Account (guest, sign in, create an account, sign out), language, country, appearance, privacy choices, deleting conversations or the account, and links to the rest of Waypoint on the website | Settings work; account actions need a connection |
| **Getting started** | Country, name, what's going on, and privacy choices (all off until turned on) | Needs a connection |

Path, Money, Goals, Mind, Circles, Health, Services, Surroundings and Signals open on the
website for now (More → *More on the website*); see *Next* below.

---

## Accounts and sessions

- **Guest first.** Nothing needs an account until it does: the first time someone gets started,
  asks something or saves a choice, the app starts a guest session and tells Waypoint only their
  language, country and time zone. Creating an account later keeps everything the guest did
  (the same merge as on the website).
- **Where the session lives.** Better Auth's Expo plugin keeps the session cookie in the
  phone's secure keystore (Keychain on iOS, Keystore-backed storage on Android) and sends it
  with each request; native requests keep no cookies of their own.
- **Origin.** Native requests have no `Origin` header, so the app sends its scheme,
  `waypoint://`, which the server trusts (`packages/auth`). In development the server also
  trusts `exp://` so Expo Go can sign in; production doesn't.
- **Signing out** removes the keystore copy even with no connection. **Deleting the account**
  is in More → Privacy & data, as the App Store requires for apps that create accounts.

## What stays on the phone

| Kept on the phone | Where |
| --- | --- |
| The session cookie | Secure keystore |
| Language, appearance, country, "welcome seen" | App storage (`waypoint.settings.v1`) |
| The last "reach us by text" numbers | App storage (`waypoint.channels.v1`) |

Nothing typed into Shield is kept or sent unless the person asks for a second opinion.
Messages in Ask go to the server and follow the same retention setting as on the website.
The app asks for no permissions: calls and texts are handed to the phone's own apps, and
microphone and location are blocked in the Android manifest.

---

## Languages and right to left

All seven languages, with the same messages as the website (`packages/i18n`, namespace
`mobile` for the few app-only words). The phone's language is used until the person picks one.

- **Arabic** turns the whole layout right to left. A phone can only do that on a restart, so
  the language screen offers **Restart now** (the web build switches at once).
- Phone numbers and codes stay in the right order inside Arabic text (Unicode isolates, the
  same helper as the website: `@waypoint/core/text`).
- **Fonts:** Overpass (the design system's road-sign face) for Latin scripts; Hindi and Arabic
  use the phone's own fonts, with more room between lines for marks above and below.
- **Plurals:** Hermes has no `Intl.PluralRules`; `src/plural-rules.ts` carries the CLDR rules
  for the seven languages (Arabic has six forms), tested against the full Unicode data. The
  general polyfill would add about 450 KB.
- **Country names** come from the Unicode data at build time (`src/country-names.ts`, checked
  by a test) because Hermes has no `Intl.DisplayNames` either.

## Design

The same design system as the website, resolved to native values from `@waypoint/tokens`:
the one slate **Sign** per screen with its signal-yellow edge (the title flips like a
departures board when the step changes, or simply appears with reduced motion), transit-line
routes for the week, module marks in their line colours, hairline panels on the concrete
canvas, and a signal-yellow marker on the active tab. **Help** is always in the calm support
blue so it can be found in a hurry. Every control is at least 48 points; text follows the
phone's text size (headings up to a limit); light and dark follow the phone unless chosen.
Icons are the website's Phosphor set, generated into `src/ui/icon-paths.ts` (54 icons in two
weights, instead of shipping 1,500 in six).

---

## Running it

```bash
pnpm dev                                   # the website and API, http://localhost:3000
pnpm --filter @waypoint/mobile dev         # the app: scan the QR code with Expo Go
```

The app reads the server's address when it's built or started:

```bash
# Android emulator → your computer
EXPO_PUBLIC_WAYPOINT_URL=http://10.0.2.2:3000 pnpm --filter @waypoint/mobile dev
# A phone on the same Wi-Fi (use your computer's address)
EXPO_PUBLIC_WAYPOINT_URL=http://192.168.1.20:3000 pnpm --filter @waypoint/mobile dev
```

If the API runs on its own address (`apps/api`), set `EXPO_PUBLIC_WEBSITE_URL` to the
website's so its links open there.

**Web preview** (`pnpm --filter @waypoint/mobile web`, port 8081) calls the API from another
origin, so allow it on the server: `WEB_ORIGINS=http://localhost:8081` in `.env.local`.

## Building for the stores

`apps/mobile/eas.json` has two profiles for [EAS Build](https://docs.expo.dev/build/introduction/):
**preview** (an installable APK and an ad-hoc iOS build for testers) and **production**
(store builds; the build number goes up by itself).

1. `npm install -g eas-cli`, then in `apps/mobile`: `eas login` and `eas init`.
2. Set the real addresses in `eas.json` (`EXPO_PUBLIC_WAYPOINT_URL` per profile).
3. `eas build --platform android --profile preview` (or `--platform ios`, `production`).
4. `eas submit --platform android|ios --profile production`.

The app id is `org.waypoint.app` on both platforms (`app.config.ts`). Before submitting, fill in
the stores' privacy forms from this page and [PRIVACY.md](PRIVACY.md), and give them the privacy
notice and terms addresses (`/privacy` and `/terms` on your website; the app links both from
More → About, and shows the agreement when people create an account or finish getting started).
Messaging and health-adjacent apps are reviewed closely: describe the crisis support and that
Waypoint is not an emergency service.

## Checks

- `pnpm --filter @waypoint/mobile typecheck` and `test` (plural rules against Unicode's,
  answer Markdown, country names up to date) run with the rest in `pnpm check` and CI.
- `pnpm --filter @waypoint/mobile export` bundles the iOS and Android apps with Hermes, as a
  store build would; CI runs it on every change.

## Performance on low-cost phones

- **Scam Shield on Hermes.** A Unicode-aware word edge used to cost four copies of every
  letter range in Unicode per `\b`; Hermes compiles each copy into the pattern, so the rules
  came to about 19 MB and took seconds to compile on an older phone. The edges are now built
  from the scripts people write to Waypoint in, and use one lookaround where the pattern already
  knows one side (`packages/core/src/text/boundary.ts`): about 2 MB and a twelfth of the time,
  matching exactly what the full edge matched (`packages/core/test/boundary.test.ts`). The
  rules are also compiled the first time they're needed, not at start-up.
- The app's JavaScript is about 6.5 MB of Hermes bytecode. The largest parts are React Native,
  Expo Router, and the AI SDK's chat client with zod (about 1 MB, kept so the app speaks
  exactly the website's conversation protocol, including tool approvals).

---

## Next

- **Signed-in website pages inside the app** — an in-app web view handed a one-time sign-in
  token that only the app can use (bound to a request header a browser link can't send), so
  Path, Money, Goals, Mind, Circles and the rest open without a second sign-in.
- **Push notifications** for the reminders people set and the gentle follow-up after a hard
  moment, through the same attention governor (daily budget, quiet hours).
- **App lock** (face, fingerprint or PIN) for people who share a phone, and a quick-exit
  gesture.
- **Today offline**: keep the last Today and plan on the phone.
- Native screens for Money, Goals and Mind, in that order.
