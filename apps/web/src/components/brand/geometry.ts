/**
 * The Waypoint mark, drawn once. The React logo (Logo.tsx), the master SVGs in
 * public/brand, the favicon (app/icon.svg) and every app icon PNG are made from these
 * numbers by `pnpm brand` (scripts/brand/build.mts), so they can never drift apart.
 *
 * The idea: the "i" of information (a dot over a stem, the sign every station and airport
 * uses for "ask here") carries a direction sign. A place to find out where you are and where
 * to go next: the next step, and someone to ask.
 *
 * A 64 × 64 grid. All three parts are one colour, so the mark works in a single colour (the
 * monochrome Android icon, a favicon in a dark tab bar) with nothing to change.
 */
export const MARK_GRID = 64;

/** The rounded square behind the glyph, when it has one. */
export const TILE_RADIUS = 15;

/** The dot of the "i": the waypoint itself. */
export const DOT = { cx: 19, cy: 13, r: 5.5 } as const;

/** The stem, drawn as a stroke with a round foot (its top is under the sign). */
export const STEM = { d: 'M19 24V51.5', width: 7.5 } as const;

/** The direction sign, a board with an arrow end; its corners are rounded by a 3-unit stroke. */
export const SIGN = { d: 'M19 24H38.5L47 32.5 38.5 41H19Z', width: 3 } as const;

/**
 * Where the glyph's ink lies on the grid (stroke and round caps included), for fitting it
 * into an icon's safe zone.
 */
export const GLYPH_BOX = { x: 15.25, y: 7.5, width: 33.25, height: 47.75 } as const;

/** The two brand colours, as hex for files that cannot read the tokens (icons, email). */
export const BRAND_HEX = {
  /** --wp-sign in the light theme. */
  slate: '#2b3645',
  /** --wp-signal. */
  signal: '#f5c533',
  /** A lighter slate for the tile on a dark background (a browser tab bar in dark mode). */
  slateOnDark: '#3e4d61',
  /** The wordmark on a dark background. */
  paper: '#f4f6f8',
} as const;

/** The glyph as SVG markup in one colour, for files written by the build. */
export function glyphSvg(fill: string): string {
  return [
    `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${fill}"/>`,
    `<path d="${STEM.d}" fill="none" stroke="${fill}" stroke-width="${STEM.width}" stroke-linecap="round"/>`,
    `<path d="${SIGN.d}" fill="${fill}" stroke="${fill}" stroke-width="${SIGN.width}" stroke-linejoin="round"/>`,
  ].join('');
}
