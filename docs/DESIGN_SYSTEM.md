# Design system

The rules live in [`.ux-profile.md`](../.ux-profile.md); tokens in `packages/tokens`;
components in `packages/ui`. A live showcase runs at `/design`: every component and every
state, with switches for light, dark and lite mode. `/design/module` is an example module
page built from the page parts.

## Concept: wayfinding signage

People open Waypoint in transit between jobs, countries and life stages — often stressed,
reading in a second language, on a cheap phone in sunlight. Airport and transit wayfinding
solves that problem, so the interface borrows its discipline:

- **The Sign** — one bold slate panel per screen at most, answering "where do I go now?".
  Completing a step flips it like a departures board while the route fills to the next
  station (the only orchestrated motion).
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

`packages/tokens/src/index.ts` is the one source. `pnpm --filter @waypoint/tokens build`
writes `tokens.css` (committed); the phone app reads the same values through `nativeTheme()`.
`packages/tokens/test` checks every text pair, status colours on overlays and on dark tints,
text on the focus, hover and pressed fills (a focused menu item or list row, a button on the
Sign), the Sign against the page, the marker and the focus ring on each surface, in both
themes.

### Depth

| Token | Use |
| --- | --- |
| `--wp-shadow-1` | Panels, lists, cards at rest. Two soft layers in the light. |
| `--wp-shadow-2` | The Sign, a card under the pointer, tooltips. |
| `--wp-shadow-3` | Menus, dialogs, sheets, toasts. |

`--wp-shadow-raised` and `--wp-shadow-overlay` still work and point at steps 1 and 3.

In the dark a shadow hardly shows, so depth comes from the surfaces: canvas, raised and
overlay are each about 1.2:1 from the last, and each elevation step carries a lit top edge.
The Sign is lit in the dark: a brighter slate, 3:1 against the page (13.5:1 in the light),
with a wider signal edge (`--wp-sign-edge`).

### States

| Token | Use |
| --- | --- |
| `--wp-fill-hover`, `--wp-fill-pressed` | The text colour thinned out, laid over a control under the pointer or while pressed. Works on any surface. |
| `--wp-sign-fill-hover`, `--wp-sign-fill-pressed`, `--wp-sign-border` | The same for controls on the Sign or a toast. |
| `--wp-press-scale` | How far a control gives when pressed (0.97). |
| `--wp-marker` | The bar under the chosen tab or nav item: 3:1 on every surface. |
| `--wp-focus-shadow` | The focus ring: 2px in the text colour and a 3px signal halo. |
| `--wp-focus-shadow-inset` | The same ring drawn inside, for flush rows, tabs and triggers. |
| `--wp-focus-shadow-on-sign` | The same ring in the Sign's text colour. The Sign and the toast set `--wp-focus-shadow` to it, so controls inside them need nothing special. |

What every component does, and what page styles should do too:

- **Focus** is `box-shadow: var(--wp-focus-shadow)` and nothing else. Keep
  `outline: 2px solid transparent` so Windows forced-colours mode still shows an outline.
- **Pressed**: `scale: var(--wp-press-scale)` or `background: var(--wp-fill-pressed)`, on
  React Aria's `[data-pressed]` (`:active` on a plain link).
- **Hover** goes inside `@media (hover: hover)`, so a fill never stays on after a tap.
- **Transitions** on state take `var(--wp-duration-fast)` (120ms).

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--wp-duration-instant` | 80ms | Tooltips and menus leaving |
| `--wp-duration-fast` | 120ms | Hover, pressed, focus |
| `--wp-duration-base` | 180ms | Markers, disclosure, dialogs |
| `--wp-duration-slow` | 240ms | Sheets, toasts, meters |
| `--wp-duration-flip` | 320ms | The Sign flipping to the next step |
| `--wp-duration-route` | 480ms | The route filling to the next station (`--wp-ease-route`) |

Motion is switched off in one place, `packages/ui/src/styles/base.css`: lite mode
(`:root[data-lite="true"]`) removes every animation and transition, and
`prefers-reduced-motion: reduce` makes them instant. Components must not work around it
(no `!important` on animations, no JavaScript-driven animation): write motion as CSS
transitions and keyframes and it is handled. Where a component waits for an exit animation
(toast, dialog, disclosure) it asks the browser which animations are running, so with
motion off it simply finishes at once.

Two things move outside those rules, and each is switched off explicitly:

- **A page transition** is drawn by the browser on pseudo-elements (`::view-transition-*`)
  that `*` does not reach, so `base.css` has the same two switches written for them.
- **AnimatedNumber** counts from a script, because only a formatter function can write
  Arabic or Hindi digits. It asks `stillnessPreferred()` (exported from `@waypoint/ui`)
  before it starts, and changes at once in lite mode or when less motion is asked for. Use
  that function for any other motion that truly cannot be CSS.

## Components

Button / LinkButton, IconButton, TextField, SelectField, Checkbox, Radio, Switch, NumberField,
Stepper, SliderField, SearchField, Segmented, Tabs, Menu, Dialog / ConfirmDialog (sheet on
phones), CommandPalette, Toast, Tooltip, Disclosure, Notice, Panel, List / ListItem, Sign,
Route, ModuleMark, PageHeader, NextStops, PageTransition, RiskMeter, Probability, Stat,
StatStrip, Sparkline, ProgressRing, AnimatedNumber, EmptyState, Skeleton, PageSkeleton,
Spinner, Avatar, Prose, Icon.

All interactive components are built on React Aria (keyboard, screen readers, touch,
internationalised behaviour). Layout uses logical properties throughout, so Arabic (RTL)
works without special cases; directional icons flip automatically.

The library has no text of its own: every label, heading and screen-reader name is a prop,
translated by the app.

### A module page

`/design/module` is a whole page built from these parts (`?module=path` shows it as any
other module).

- **PageHeader** is the top of a module page and replaces the plain `.wp-page-head` block:
  `<PageHeader module="money" title={…} lead={…} actions={…} />`. One flat band in the
  module's tint (`--wp-tint-<module>`), holding the module's mark, the page's one `h1`, an
  optional lead and an optional slot for one or two page-wide actions. Never a gradient and
  never the line colour itself. On a phone the mark sits above the heading; from 48rem the
  mark, the text and the actions share a row. `id` names the heading for `aria-labelledby`.
  The token test checks the heading, the lead and the mark on every module's band in both
  themes.
- **Two columns** are app utilities (`apps/web/src/app/app.css`), not a component:

  ```html
  <div class="wp-page wp-page-wide">
    <PageHeader … />
    <div class="wp-split">
      <div class="wp-split-main">what the page is for</div>
      <div class="wp-split-aside">what goes with it</div>
    </div>
  </div>
  ```

  From 72rem the aside is a 20rem column beside the main one (on the left in Arabic: grid
  columns follow the reading direction). Below that it follows the main column, with the
  same space between panels as `.wp-page` gives, so moving panels into a split changes
  nothing on a phone. `.wp-page-wide` is exactly as wide as the two columns and their gap
  (68rem). Use a `div` for the aside: an `<aside>` inside `<main>` is a misplaced landmark.
- **NextStops** is "Also on Waypoint", at the foot of a module:
  `<NextStops title={…} stops={[{ module, title, description, href }]} />`. A named region
  with a list of rows, each with the mark of the module it leads to. It shows the first
  three stops and no more, and nothing at all when the list is empty: a list of next
  stops, never a feed or a carousel. The page chooses the stops for the person's situation.
  Pass `renderLink` to draw each row with the app's router link (for prefetching).
- **StatStrip** is a row of `Stat` figures that wraps: `<StatStrip label={…}>` with `Stat`
  children. A list, so a screen reader says how many figures there are. Each figure has a
  rule at its leading edge, so the strip looks the same on one line or three.

### Figures

Small drawings beside a number, never instead of it. No chart library: inline SVG in
`currentColor`, a module line (`module="money"`) or a chart series (`series={1}` … `6`,
the `--wp-series-*` tokens). Every one has a text alternative, and the caller writes it.

- **Sparkline**: `<Sparkline values={[…]} label="Savings over six weeks: from 400 to 1,250" />`.
  A line of values, oldest first, with the last one marked by a dot. `label` is read out
  instead of the picture, so it says the trend, not "chart". `width` and `height` are in px
  at the default text size; `min` and `max` fix the scale. No values draws nothing.
  **It does not mirror in right-to-left languages**: the oldest value is on the left and
  the newest on the right everywhere, as charts and numbers are in Arabic too.
- **ProgressRing**: `<ProgressRing value={3} total={5} label="Steps done this week" valueText="3/5" />`.
  A value out of a total with the number in the middle; a `meter` for screen readers.
  `valueText` is what is shown and read out: keep it to a number, a fraction or a
  percentage in the reader's language, and put words beside the ring. Sizes `sm`, `md`,
  `lg`. It grows to its value when it appears and moves when the value changes. **It runs
  clockwise from the top in every language**, like a clock face.
- **AnimatedNumber**: `<AnimatedNumber value={saved} format={(n) => format.number(n)} />`.
  Counts to its value when the value changes, writing every step with the formatter it is
  given (a CSS counter can only write Western digits, so the formatter is what makes
  Arabic and Hindi digits possible; it must round as well). The server, and a page without
  scripts, show the number itself. A number that is already there when the page arrives
  stands still; pass `from` to count when it first appears (after an action, not on a page
  load). While it counts, screen readers are given the number it will arrive at. It is a
  client component and `format` is a function, so use it from a client component.

### Go to

**CommandPalette** is one dialog for getting anywhere: a search field over a list of
places and actions.

```tsx
const [open, setOpen] = useState(false);
const hint = useCommandShortcut(() => setOpen(true)); // "⌘K" or "Ctrl+K", once running

<CommandPalette
  isOpen={open}
  onOpenChange={setOpen}
  title={t('goTo')}
  searchLabel={t('search')}
  emptyLabel={t('nothingMatches')}
  closeLabel={t('close')}
  countLabel={(n) => t('results', { count: n })}
  sections={[{ id: 'modules', title: t('modules'), items }]}
/>
```

- An item has an `id` (unique in the palette), a `label`, and optionally a `description`,
  a leading `mark` (a ModuleMark or an Icon), `keywords`, and either an `href` (it goes
  through the app's router) or an `onAction`. `pinned` keeps an item in the list whatever
  is typed; with `inputValue` / `onInputChange` the caller can build such a row from the
  typed text. Sections with a `title` are announced as groups.
- Matching uses React Aria's language-aware filter, not lower-casing: case and accents do
  not matter, every word typed must be found (in the label, the description or the
  keywords, in any order), and it works in Arabic and Devanagari. It follows the language:
  in Spanish, ñ is a letter of its own.
- The caret stays in the field while the arrow keys move through the list; Enter chooses
  the marked row; Escape empties the field, then closes. `countLabel` is read out as the
  list changes.
- On a phone it is a sheet that rests on top of the keyboard; on a wider screen a box near
  the top, which stays put while the list grows and shrinks. (It is the Dialog's `palette`
  variant.)
- Opening it is the caller's job. Always give it a button people can see.
  `useCommandShortcut(open)` adds Ctrl+K (Cmd+K on a Mac): it does not fire while the person
  is typing in a field, works on keyboards set to Arabic or Hindi, and returns how the
  shortcut is written on this device, to show beside the button.
- The palette is a client component, and some message namespaces (modules, forecasts) can
  only be read on the server: build the items that have an `href` there (marks included)
  and pass them to the client component that owns the palette. Items with an `onAction`
  are added on the client.

### Moving between pages

**PageTransition** wraps what changes between pages in React's `ViewTransition`: the old
page fades out (120ms) while the new one rises in (180ms), 240ms in all.

```tsx
// app/(app)/template.tsx: a template is made new for every page under it
import { PageTransition } from '@waypoint/ui';
export default function Template({ children }) {
  return <PageTransition>{children}</PageTransition>;
}
```

- Put it in a route's `template.tsx` (or in the page itself). A layout stays in place
  across pages, so there it does nothing. A template at one level is made new when the
  segment just under it changes (`/money` to `/path`); a module with pages of its own
  (`/path` to `/path/new`) needs the same template in its own folder.
- The frame stays still. Give the rail, the bottom bar and the phone header the class
  names in `viewTransition` (`viewTransition.rail`, `.bottomBar`, `.header`): the browser
  then draws each on its own, above the moving page, and the stylesheet keeps them where
  they are. Only one element on a page may carry each name.
- It needs the browser's View Transitions API with transition classes (Chrome and Edge 125
  and recent Safari and Firefox, per the Next.js guide shipped with the installed version).
  A browser without it shows the next page at once; nothing else changes.
- Lite mode removes it and a request for less motion makes it instant (in `base.css`).
- `/design` and `/design/module` use exactly this, with a bar that stays still.

### What moves, and how to use it

- **Toast.** `toast({ title, tone })` confirms an action. Add
  `action: { label, onAction }` to offer one way to respond, usually Undo: the toast then
  stays at least ten seconds, the action is a 44px target, and its label is read out with
  the message. Pressing it runs `onAction` and closes the toast. Translate the label.
- **Tabs and Segmented** move one marker to the chosen item.
- **Dialog** (and its `sheet` variant) leaves the way it came. Scrolling inside never moves
  the page behind.
- **Disclosure** opens and closes by height.
- **Route.** Keep each station's `id` the same between renders. When a station's `state`
  changes to `done`, the track fills to the next station and that dot settles. Give a
  station an `href` to make its label a link.
- **Probability and RiskMeter** grow to their value when they appear; Probability also
  moves when its value changes.
- **PageSkeleton** is the shape of a page while it loads: a heading, the Sign and two
  panels. Use it in a route's `loading.tsx` (`sign={false}` for pages without a Sign,
  `panels` for how many, and a translated `label` for screen readers). `Skeleton` blocks are
  still in lite mode and shimmer only where motion is welcome.
- **Panel** takes `interactive` when the whole panel is a way in: it lifts one step under
  the pointer.

## Layout rules the components keep

- **Panel gutter.** A Panel sets `--wp-panel-gutter` (16 px, 24 px from 48 rem). Its header
  and body use it, and rows inside a flush panel should too
  (`padding-inline: var(--wp-panel-gutter)`), so a row's text starts under the panel's title
  at every width. A panel without a header gets the same space above its content.
- **Route labels.** In a narrow container a horizontal Route shows only the current
  station's label; at either end it grows inwards, so it never leaves the container.
- **Probability.** Always a number and words together; pass `valueText` so the percentage is
  written in the reader's language.
- **Quick exit.** On wide screens it floats in the top corner, so a page's first line starts
  below it. On phones the public header is two rows in every language: the name and the
  language picker, then help, exit and sign-in with their short labels.

## Older browsers

The build targets Chrome and Edge 111, Firefox 111 and Safari 16.4. Inside the design system,
newer features have a plain value first and the newer one behind `@supports`:

- Hover and pressed fills are plain tokens, not `color-mix()`. The few mixes that remain
  (a button border, the danger and support hover shades, a notice's hairline, a station's
  halo) sit behind `@supports (color: color-mix(in oklch, red, blue))`.
- `dvh` heights sit behind `@supports (height: 100dvh)`, after a `vh` value.
- Wherever a scrollbar is hidden with `scrollbar-width: none`, a `::-webkit-scrollbar` rule
  hides it in older Safari and Chrome too.
- A page transition needs the View Transitions API. Where a browser does not have it the
  next page is shown at once, as before; no page depends on the transition.

## How the rules are kept

- `packages/ui/test/styles.test.ts` reads every stylesheet in the design system and fails
  if one draws its own focus ring, puts a hover rule outside `@media (hover: hover)`, lacks
  a pressed state or its 120ms transition, uses a physical side (left, right, a sideways
  shadow), or uses `color-mix()` or `dvh` without a plain value. It also holds the page
  transition to its rules: off in lite mode, instant with less motion, the frame named and
  still, durations from tokens.
- `packages/ui/test` renders each component the way the server does and checks what it puts
  on the page (`pages.test.tsx`, `data.test.tsx`), and checks the palette's matching in
  English, French, Spanish, Arabic and Hindi and its shortcut (`command.test.tsx`).
- `apps/web/e2e/design.spec.ts` opens `/design` in a browser: accessibility in light and
  dark, the Sign at 3:1 against the page, the focus ring, pressed and hover, the toast and
  Undo, the route fill, the markers, disclosure, dialog and sheet leaving, the meters, lite
  mode, reduced motion and Arabic. On `/design/module` and back: the header band in its
  module tint with text at 4.5:1, two columns on a wide screen and one on a phone, the
  three next stops, the go-to palette by keyboard and as a phone sheet (and matching in
  Arabic and Hindi), the figures and the counting number, and the page transition with
  the bar kept still.
- `apps/web/e2e/experience.spec.ts` checks the first pages at 375 px and 1280 px, in light and
  dark, in English and Arabic: nothing scrolls sideways or leaves the screen, every control is
  at least 24 × 24 px, the first tab stops show a focus ring, and the page mirrors for
  right-to-left. Set `AUDIT_DIR` to keep the screenshots for a look by eye.

## Lite mode

System fonts, no motion, fewer requests — for slow connections and older phones
(Settings → Appearance). Skeletons are still blocks, toasts and dialogs appear and leave at
once, and the route changes state without the fill.
