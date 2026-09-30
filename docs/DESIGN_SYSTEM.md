# Design system

The rules live in [`.ux-profile.md`](../.ux-profile.md); tokens in `packages/tokens`;
components in `packages/ui`. A live showcase runs at `/design` in development.

## Concept: wayfinding signage

People open Waypoint in transit between jobs, countries and life stages — often stressed,
reading in a second language, on a cheap phone in sunlight. Airport and transit wayfinding
solves that problem, so the interface borrows its discipline:

- **The Sign** — one bold slate panel per screen at most, answering "where do I go now?".
  Completing a step flips it like a departures board (the only orchestrated motion).
- **Route lines** — sequences (plans, onboarding, progress) drawn as transit lines with
  stations. Solid track behind you, dashed ahead.
- **Line colours** identify modules like transit lines, used only for small marks.
- **Pictograms always with words.**

## Tokens

- Colour in OKLCH with light and dark themes; text contrast ≥ 4.5:1, UI graphics ≥ 3:1.
- One typeface: Overpass (derived from US highway signage), with Noto Sans Devanagari,
  Bengali and Arabic loaded only when needed. Weights 400/500/600.
- Type scale (rem): meta 0.75 · small 0.875 · body 1 · lead 1.1875 · h4 1.4375 · h3 1.75 ·
  h2 2.0625 · h1 2.5 · sign 3.
- Spacing on a 4px base; radii 4–14px; motion 120–240ms with reduced-motion support.

## Components

Button / LinkButton, IconButton, TextField, SelectField, Checkbox, Radio, Switch, NumberField,
SliderField, SearchField, Segmented, Tabs, Menu, Dialog / ConfirmDialog (sheet on phones),
Toast, Tooltip, Disclosure, Notice, Panel, List / ListItem, Sign, Route, ModuleMark,
RiskMeter, Probability, Stat, EmptyState, Skeleton, Spinner, Avatar, Prose, Icon.

All interactive components are built on React Aria (keyboard, screen readers, touch,
internationalised behaviour). Layout uses logical properties throughout, so Arabic (RTL)
works without special cases; directional icons flip automatically.

## Lite mode

System fonts, no motion, fewer requests — for slow connections and older phones
(Settings → Appearance).
