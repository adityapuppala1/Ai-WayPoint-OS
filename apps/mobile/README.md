# Waypoint for iOS and Android

The Expo (React Native) app: Today, Scam Shield, Ask, Get help now and settings, sharing
`@waypoint/core`, `@waypoint/content`, `@waypoint/i18n` and `@waypoint/tokens` with the website
and calling the same API. Scam checks and help lines work with no connection.

```bash
pnpm dev                                   # from the repository root: website + API on :3000
pnpm --filter @waypoint/mobile dev         # this app; open it in Expo Go
```

Set `EXPO_PUBLIC_WAYPOINT_URL` to the server's address as the phone sees it
(`http://10.0.2.2:3000` from the Android emulator, your computer's LAN address from a phone).

| Command | What it does |
| --- | --- |
| `pnpm dev` / `android` / `ios` / `web` | Start the development server (and open a simulator or browser) |
| `pnpm typecheck`, `pnpm test` | Types and unit tests |
| `pnpm export` | Bundle for iOS and Android with Hermes, as a store build would |
| `pnpm icons` | Regenerate `src/ui/icon-paths.ts` from Phosphor (after adding an icon) |
| `pnpm country-names` | Regenerate `src/country-names.ts` (after adding a country) |

```
app/            screens (Expo Router): (tabs)/ Today, Shield, Ask, Help, More; start, account,
                language, country, privacy, report, conversations, welcome
src/            api, auth (Better Auth + secure keystore), session, i18n, settings, theme,
                plural rules, links; ui/ the design system; features/ Shield result,
                crisis card, Ask
test/           unit tests (Vitest)
```

Everything else — accounts, offline behaviour, building for the stores — is in
[docs/MOBILE.md](../../docs/MOBILE.md).
