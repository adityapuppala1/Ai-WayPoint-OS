/**
 * Waypoint design tokens — the single source of truth for web (CSS custom properties,
 * generated into tokens.css) and native (hex theme objects).
 *
 * Concept: wayfinding signage + transit route lines. See .ux-profile.md and
 * docs/DESIGN_SYSTEM.md for the reasoning behind every choice here.
 */
import { contrast, contrastOnTint, type Oklch, oklch, toHex } from './color';

export { contrast, contrastOnTint, type Oklch, oklch, toCss, toHex } from './color';

// ─────────────────────────────── Colour ───────────────────────────────

/** Semantic colour roles. Components only ever use these names, never raw values. */
export interface ColorRoles {
  canvas: Oklch; // L0 page background (~60% of the screen)
  raised: Oklch; // L1 panels, lists, nav (~30%)
  sunken: Oklch; // inset wells, input backgrounds, skeletons
  overlay: Oklch; // L2 menus, dialogs, sheets
  borderSubtle: Oklch;
  borderStrong: Oklch;
  text: Oklch;
  textSecondary: Oklch;
  textMuted: Oklch;
  textInverse: Oklch;
  sign: Oklch; // the Next Step sign panel
  signText: Oklch;
  signMuted: Oklch;
  signal: Oklch; // the one accent: primary CTA fill, focus halo, active marker
  signalHover: Oklch;
  signalInk: Oklch; // text on signal
  signalTint: Oklch; // link hover highlight, selected rows
  marker: Oklch; // the bar under the chosen tab or nav item: 3:1 on every surface
  focusRing: Oklch;
  danger: Oklch;
  dangerTint: Oklch;
  caution: Oklch;
  cautionTint: Oklch;
  safe: Oklch;
  safeTint: Oklch;
  info: Oklch;
  infoTint: Oklch;
  support: Oklch; // calm "harbour" blue for crisis & support moments — never alarm red
  supportTint: Oklch;
  scrim: Oklch;
}

const INK_HUE = 250;

export const light: ColorRoles = {
  canvas: oklch(0.968, 0.004, 220),
  raised: oklch(1, 0, 0),
  sunken: oklch(0.945, 0.006, 225),
  overlay: oklch(1, 0, 0),
  borderSubtle: oklch(0.24, 0.03, INK_HUE, 0.11),
  borderStrong: oklch(0.24, 0.03, INK_HUE, 0.26),
  text: oklch(0.24, 0.03, INK_HUE),
  textSecondary: oklch(0.41, 0.026, INK_HUE),
  textMuted: oklch(0.49, 0.02, INK_HUE),
  textInverse: oklch(0.985, 0.003, INK_HUE),
  sign: oklch(0.275, 0.038, INK_HUE),
  signText: oklch(0.985, 0.003, INK_HUE),
  signMuted: oklch(0.84, 0.014, INK_HUE),
  signal: oklch(0.855, 0.165, 88),
  signalHover: oklch(0.8, 0.165, 83),
  signalInk: oklch(0.24, 0.03, INK_HUE),
  signalTint: oklch(0.965, 0.055, 95),
  // Slate, not yellow: the signal alone is 1.4:1 on a light page, too faint to mark a choice.
  marker: oklch(0.24, 0.03, INK_HUE),
  focusRing: oklch(0.24, 0.03, INK_HUE),
  danger: oklch(0.505, 0.19, 27),
  dangerTint: oklch(0.962, 0.024, 25),
  caution: oklch(0.52, 0.125, 62),
  cautionTint: oklch(0.965, 0.045, 85),
  safe: oklch(0.49, 0.11, 155),
  safeTint: oklch(0.962, 0.03, 155),
  info: oklch(0.49, 0.125, 255),
  infoTint: oklch(0.962, 0.022, 255),
  support: oklch(0.43, 0.085, 232),
  supportTint: oklch(0.958, 0.022, 232),
  scrim: oklch(0.2, 0.03, INK_HUE, 0.42),
};

/**
 * Dark: three surface steps a person can tell apart without a hairline (each about 1.2:1
 * from the last, where they used to be 1.08:1), and a Sign that is lit: a brighter, bluer
 * slate at 3:1 against the page, where the old one was 1.36:1 and read as one more panel.
 * The canvas itself is unchanged, so the browser's theme colour still matches it.
 */
export const dark: ColorRoles = {
  canvas: oklch(0.19, 0.018, INK_HUE),
  raised: oklch(0.255, 0.022, INK_HUE),
  sunken: oklch(0.155, 0.016, INK_HUE),
  overlay: oklch(0.32, 0.026, INK_HUE),
  borderSubtle: oklch(0.985, 0.003, INK_HUE, 0.12),
  borderStrong: oklch(0.985, 0.003, INK_HUE, 0.26),
  text: oklch(0.95, 0.006, INK_HUE),
  textSecondary: oklch(0.82, 0.012, INK_HUE),
  textMuted: oklch(0.72, 0.014, INK_HUE),
  textInverse: oklch(0.2, 0.02, INK_HUE),
  sign: oklch(0.5, 0.06, INK_HUE),
  signText: oklch(0.985, 0.003, INK_HUE),
  signMuted: oklch(0.93, 0.012, INK_HUE),
  signal: oklch(0.855, 0.165, 88),
  signalHover: oklch(0.9, 0.15, 92),
  signalInk: oklch(0.22, 0.03, INK_HUE),
  signalTint: oklch(0.855, 0.165, 88, 0.16),
  marker: oklch(0.95, 0.006, INK_HUE),
  focusRing: oklch(0.95, 0.006, INK_HUE),
  danger: oklch(0.72, 0.16, 25),
  dangerTint: oklch(0.72, 0.16, 25, 0.14),
  caution: oklch(0.8, 0.13, 75),
  cautionTint: oklch(0.8, 0.13, 75, 0.14),
  safe: oklch(0.77, 0.12, 155),
  safeTint: oklch(0.77, 0.12, 155, 0.14),
  info: oklch(0.77, 0.1, 250),
  infoTint: oklch(0.77, 0.1, 250, 0.14),
  support: oklch(0.79, 0.075, 232),
  supportTint: oklch(0.79, 0.075, 232, 0.14),
  scrim: oklch(0.08, 0.01, INK_HUE, 0.6),
};

/**
 * Module line colours — like transit lines, one per module, evenly spaced in hue with
 * matched lightness and chroma so no line shouts louder than another. Used only for
 * small marks: station dots, pictogram tint, the active-nav bar, chart series.
 */
export const MODULE_LINES = {
  today: 88, // signal yellow family (brand)
  path: 155,
  shield: 50,
  circles: 330,
  ask: INK_HUE,
  signals: 255,
  money: 190,
  mind: 290,
  health: 10,
  civic: 75,
  surroundings: 225,
  goals: 120,
  org: 270,
} as const;
export type ModuleLine = keyof typeof MODULE_LINES;

export function moduleLine(module: ModuleLine, mode: 'light' | 'dark' = 'light'): Oklch {
  const hue = MODULE_LINES[module];
  if (module === 'today') return mode === 'light' ? oklch(0.62, 0.13, 80) : oklch(0.855, 0.165, 88);
  if (module === 'ask') return mode === 'light' ? oklch(0.36, 0.03, hue) : oklch(0.86, 0.012, hue);
  return mode === 'light' ? oklch(0.545, 0.13, hue) : oklch(0.74, 0.12, hue);
}

/** Light tint of a module line for pictogram backgrounds. */
export function moduleTint(module: ModuleLine, mode: 'light' | 'dark' = 'light'): Oklch {
  const hue = MODULE_LINES[module];
  return mode === 'light' ? oklch(0.955, 0.035, hue) : oklch(0.74, 0.12, hue, 0.16);
}

/**
 * Categorical series for charts (colour-blind-aware order: blue, orange, teal, magenta,
 * olive, violet). Always paired with direct labels — never colour alone.
 */
export const SERIES_HUES = [255, 50, 190, 330, 120, 290] as const;
export function series(index: number, mode: 'light' | 'dark' = 'light'): Oklch {
  const hue = SERIES_HUES[index % SERIES_HUES.length] ?? 255;
  return mode === 'light' ? oklch(0.56, 0.13, hue) : oklch(0.74, 0.12, hue);
}

// ─────────────────────────────── Type ───────────────────────────────

export const fontFamily = {
  sans: [
    // One glyph (U+00B7): Overpass's middle dot, fixed. See packages/ui/src/fonts/README.md.
    '"Waypoint Dot"',
    '"Overpass Variable"',
    'Overpass',
    '"Noto Sans Devanagari Variable"',
    '"Noto Sans Bengali Variable"',
    '"Noto Sans Arabic Variable"',
    'system-ui',
    '-apple-system',
    '"Segoe UI"',
    'Roboto',
    '"Nirmala UI"',
    '"Noto Sans"',
    'sans-serif',
  ].join(', '),
  system: [
    'system-ui',
    '-apple-system',
    '"Segoe UI"',
    'Roboto',
    '"Nirmala UI"',
    '"Noto Sans"',
    'sans-serif',
  ].join(', '),
} as const;

/** Minor-third scale from a 16px body. rem values. */
export const fontSize = {
  meta: 0.75, // 12px — timestamps, legal, helper text only
  small: 0.875, // 14px — secondary text, list rows, form hints
  body: 1, // 16px
  lead: 1.1875, // 19px
  h4: 1.4375, // 23px
  h3: 1.75, // 28px
  h2: 2.0625, // 33px
  h1: 2.5, // 40px
  sign: 3, // 48px — the Next Step sign on large screens
} as const;

export const fontWeight = { regular: 400, medium: 500, semibold: 600 } as const;

export const lineHeight = { tight: 1.15, snug: 1.25, meta: 1.4, body: 1.55 } as const;

// ─────────────────────────────── Space & shape ───────────────────────────────

/** 4pt grid, in px. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radius = {
  xs: 4, // tags, small marks
  sm: 6, // controls: buttons, inputs
  md: 10, // panels, lists
  lg: 14, // the sign, dialogs
  round: 999, // stations, switches, interactive chips only
} as const;

/**
 * Elevation: three steps. 1 is a panel resting on the page, 2 is something lifted (a card
 * under the pointer, a sticky bar), 3 floats above everything (menus, dialogs, sheets,
 * toasts). Each light step is two layers: a tight contact shadow and a soft ambient one.
 * In the dark a shadow hardly shows, so each step also carries a lit top edge, and the
 * floating step a faint ring, on top of the lighter surface colour.
 */
export const elevation = {
  light: {
    1: '0 1px 2px rgb(16 24 40 / 0.06), 0 2px 6px rgb(16 24 40 / 0.04)',
    2: '0 2px 4px rgb(16 24 40 / 0.06), 0 8px 20px rgb(16 24 40 / 0.09)',
    3: '0 4px 10px rgb(16 24 40 / 0.08), 0 18px 44px rgb(16 24 40 / 0.14)',
  },
  dark: {
    1: 'inset 0 1px 0 rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.3)',
    2: 'inset 0 1px 0 rgb(255 255 255 / 0.07), 0 6px 16px rgb(0 0 0 / 0.4)',
    3: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 0 1px rgb(255 255 255 / 0.06), 0 18px 44px rgb(0 0 0 / 0.5)',
  },
} as const;

/**
 * Focus, the same on every control: a 2px ring in the text colour and a 3px signal-yellow
 * halo around it. Two colours, so one of them stands out on any surface (the ring on light
 * ones, the halo on the slate sign). Controls that sit flush in a row or are clipped by
 * their container draw the same ring inside their edge.
 */
const FOCUS_RING = 2;
const FOCUS_HALO = 3;
export const focus = {
  ring: FOCUS_RING,
  halo: FOCUS_HALO,
  shadow: `0 0 0 ${FOCUS_RING}px var(--wp-focus-ring), 0 0 0 ${FOCUS_RING + FOCUS_HALO}px var(--wp-signal)`,
  shadowInset: `inset 0 0 0 ${FOCUS_RING}px var(--wp-focus-ring), inset 0 0 0 ${FOCUS_RING + FOCUS_HALO}px var(--wp-signal)`,
} as const;

export const motion = {
  instant: 80,
  fast: 120,
  base: 180,
  slow: 240,
  flip: 320,
  // The route filling to the next station: the one movement that is meant to be watched.
  route: 480,
  easeOut: 'cubic-bezier(0.2, 0, 0, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeStandard: 'cubic-bezier(0.2, 0, 0.2, 1)',
  // Leaves the station gently and settles into the next one.
  easeRoute: 'cubic-bezier(0.45, 0, 0.15, 1)',
  // How far a control gives under a finger or the pointer.
  pressScale: 0.97,
} as const;

export const zIndex = { nav: 20, header: 30, overlay: 40, toast: 50, skip: 60 } as const;

export const layout = {
  readingMax: 42, // rem — ~68ch body text
  contentMax: 46, // rem — main column
  appMax: 80, // rem
  railWidth: 16, // rem — desktop navigation
  asideWidth: 20, // rem — contextual column at ≥1280px
  bottomBar: 4, // rem (+ safe area)
  touchMin: 2.75, // rem — 44px
} as const;

export const breakpoints = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;

// ─────────────────────────────── Native theme ───────────────────────────────

export type HexRoles = { [K in keyof ColorRoles]: string };

export function hexRoles(mode: 'light' | 'dark'): HexRoles {
  const roles = mode === 'light' ? light : dark;
  return Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, toHex(v)])) as HexRoles;
}

/** Everything React Native needs, pre-resolved to hex and px. */
export function nativeTheme(mode: 'light' | 'dark') {
  return {
    mode,
    colors: hexRoles(mode),
    modules: Object.fromEntries(
      (Object.keys(MODULE_LINES) as ModuleLine[]).map((m) => [
        m,
        { line: toHex(moduleLine(m, mode)), tint: toHex(moduleTint(m, mode)) },
      ]),
    ) as Record<ModuleLine, { line: string; tint: string }>,
    fontSize: Object.fromEntries(Object.entries(fontSize).map(([k, v]) => [k, v * 16])) as Record<
      keyof typeof fontSize,
      number
    >,
    fontWeight,
    lineHeight,
    space,
    radius,
    motion,
  };
}

// ─────────────────────────────── Contrast checks ───────────────────────────────

export interface ContrastCheck {
  pair: string;
  ratio: number;
  min: number;
  pass: boolean;
}

/** Text pairs must meet 4.5:1; large display text and UI graphics 3:1 (WCAG 2.2 AA). */
export function contrastReport(mode: 'light' | 'dark'): ContrastCheck[] {
  const r = mode === 'light' ? light : dark;
  const checks: Array<[string, Oklch, Oklch, number]> = [
    ['text / canvas', r.text, r.canvas, 4.5],
    ['text / raised', r.text, r.raised, 4.5],
    ['textSecondary / canvas', r.textSecondary, r.canvas, 4.5],
    ['textSecondary / raised', r.textSecondary, r.raised, 4.5],
    ['textMuted / raised', r.textMuted, r.raised, 4.5],
    ['textMuted / canvas', r.textMuted, r.canvas, 4.5],
    ['signText / sign', r.signText, r.sign, 4.5],
    ['signMuted / sign', r.signMuted, r.sign, 4.5],
    ['signalInk / signal', r.signalInk, r.signal, 4.5],
    ['signal / sign (marker)', r.signal, r.sign, 3],
    ['danger / raised', r.danger, r.raised, 4.5],
    ['caution / raised', r.caution, r.raised, 4.5],
    ['safe / raised', r.safe, r.raised, 4.5],
    ['info / raised', r.info, r.raised, 4.5],
    ['support / raised', r.support, r.raised, 4.5],
    ['focusRing / canvas', r.focusRing, r.canvas, 3],
    // Menus, dialogs and sheets are a surface of their own: everything must read there too.
    ['text / overlay', r.text, r.overlay, 4.5],
    ['textSecondary / overlay', r.textSecondary, r.overlay, 4.5],
    ['textMuted / overlay', r.textMuted, r.overlay, 4.5],
    ['danger / overlay', r.danger, r.overlay, 4.5],
    ['caution / overlay', r.caution, r.overlay, 4.5],
    ['safe / overlay', r.safe, r.overlay, 4.5],
    ['info / overlay', r.info, r.overlay, 4.5],
    ['support / overlay', r.support, r.overlay, 4.5],
    ['text / sunken', r.text, r.sunken, 4.5],
    ['textSecondary / sunken', r.textSecondary, r.sunken, 4.5],
    // The Sign is the one bold element: it must stand out from the page as a shape.
    ['sign / canvas', r.sign, r.canvas, 3],
    // The bar that marks the chosen tab or nav item.
    ['marker / canvas', r.marker, r.canvas, 3],
    ['marker / raised', r.marker, r.raised, 3],
    ['marker / sunken', r.marker, r.sunken, 3],
  ];
  if (mode === 'light') {
    checks.push(
      ['danger / dangerTint', r.danger, r.dangerTint, 4.5],
      ['caution / cautionTint', r.caution, r.cautionTint, 4.5],
      ['safe / safeTint', r.safe, r.safeTint, 4.5],
      ['info / infoTint', r.info, r.infoTint, 4.5],
      ['support / supportTint', r.support, r.supportTint, 4.5],
    );
  }
  for (const m of Object.keys(MODULE_LINES) as ModuleLine[]) {
    if (m === 'today') continue; // brand yellow marks sit on the slate sign or carry a label
    checks.push([`line:${m} / raised`, moduleLine(m, mode), r.raised, 3]);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const report = checks.map(([pair, a, b, min]) => {
    const ratio = round(contrast(a, b));
    return { pair, ratio, min, pass: ratio >= min };
  });
  if (mode === 'dark') {
    // Dark tints are see-through: check each status colour against its tint lying on a panel.
    for (const tone of ['danger', 'caution', 'safe', 'info', 'support'] as const) {
      const ratio = round(contrastOnTint(r[tone], r[`${tone}Tint`], r.raised));
      report.push({ pair: `${tone} / ${tone}Tint on raised`, ratio, min: 4.5, pass: ratio >= 4.5 });
    }
  }
  // Focus is a ring and a halo in two colours; on each surface the clearer of the two counts.
  const focusOn: Array<[string, Oklch, Oklch]> = [
    ['canvas', r.canvas, r.focusRing],
    ['raised', r.raised, r.focusRing],
    ['sunken', r.sunken, r.focusRing],
    ['overlay', r.overlay, r.focusRing],
    ['sign', r.sign, r.signText], // on the Sign the ring takes the Sign's text colour
  ];
  for (const [name, surface, ring] of focusOn) {
    const ratio = round(Math.max(contrast(ring, surface), contrast(r.signal, surface)));
    report.push({ pair: `focus / ${name}`, ratio, min: 3, pass: ratio >= 3 });
  }
  return report;
}
