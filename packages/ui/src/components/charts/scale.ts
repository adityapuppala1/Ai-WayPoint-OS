/**
 * The arithmetic behind the charts, kept apart from React so it can be checked on its own:
 * rounded axis ticks, mapping a value to a position, which shade of a ramp a value takes,
 * whether end labels would overlap, and where an arrow key moves the reader.
 */

/** One of the six chart colours (`--wp-series-1` … `--wp-series-6`). */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The order the charts hand out colours in: blue, orange, violet, olive. It is not 1, 2, 3, 4
 * because teal (3) and magenta (4) look almost the same to people with red-green colour
 * blindness (ΔE 3.2 light, 2.5 dark), and blue and violet (1, 6) or orange and olive (2, 5)
 * do too. In this order every pair of neighbours is far apart for everyone (ΔE ≥ 20 in both
 * themes). A chart shows at most four series, so four slots are enough.
 */
export const SERIES_ORDER: readonly SeriesSlot[] = [1, 2, 6, 5];

/** The most series a line or stacked chart draws; the rest are folded into one "other". */
export const MAX_SERIES = 4;

/** The colour slot for the series at `index`, unless the caller chose one. */
export function seriesSlot(index: number, chosen?: SeriesSlot): SeriesSlot {
  return chosen ?? SERIES_ORDER[Math.min(index, SERIES_ORDER.length - 1)] ?? 1;
}

/** A step size that reads well on an axis: 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Round ticks for a value axis that starts at zero (or below it, if a value is negative) and
 * reaches at least `max`, in about `count` steps. Bars must start at zero, or their lengths
 * lie; lines share the rule so two charts side by side read the same way.
 */
export function niceTicks(max: number, count = 4, min = 0): number[] {
  const low = Math.min(0, Number.isFinite(min) ? min : 0);
  const high = Number.isFinite(max) && max > low ? max : low + 1;
  const step = niceStep((high - low) / Math.max(1, count));
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  // Rounding to the step's precision keeps 0.1 + 0.2 from printing as 0.30000000000000004.
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  for (let t = first; t <= last + step / 2; t += step) ticks.push(Number(t.toFixed(digits)));
  return ticks;
}

/** A straight mapping from a domain (values) onto a range (pixels). */
export function linear(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0));
}

/** The largest finite number among the values (0 when there is none). */
export function maxOf(values: Iterable<number | null | undefined>): number {
  let max = 0;
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v) && v > max) max = v;
  return max;
}

/**
 * The x position of point `index` of `count` across a width: the first on the start edge
 * and the last on the end edge, so the newest value sits where the eye ends.
 */
export function pointX(index: number, count: number, start: number, width: number): number {
  if (count <= 1) return start + width / 2;
  return start + (index * width) / (count - 1);
}

/** The point nearest to an x position: the crosshair snaps to it. */
export function nearestPoint(x: number, count: number, start: number, width: number): number {
  if (count <= 1) return 0;
  const i = Math.round(((x - start) / width) * (count - 1));
  return Math.min(count - 1, Math.max(0, i));
}

/** The column under an x position, when the width is shared into equal bands. */
export function bandAt(x: number, count: number, start: number, width: number): number {
  if (count <= 1) return 0;
  const i = Math.floor(((x - start) / width) * count);
  return Math.min(count - 1, Math.max(0, i));
}

/**
 * How thick a column is in a band: never more than 24px, and never the whole band, so the
 * air between columns stays (at least 2px of it, the gap that separates touching marks).
 */
export function barThickness(band: number, max = 24): number {
  const thick = Math.min(max, band * 0.62, band - 2);
  return Math.max(1, Math.round(thick * 10) / 10);
}

/**
 * The share of the way from the first ramp step to the last that each step mixes in of the
 * series colour (the rest is the chart surface). Light to dark on a light page, dark to light
 * on a dark one, so "more" always stands out further from the page. Six steps: enough to read
 * an order, few enough that neighbours stay apart (each step moves lightness by ≥ 0.06).
 */
export const RAMP_MIX = [10, 24, 38, 52, 76, 100] as const;

/**
 * Which step of the ramp a value falls in, 0 to 5. The scale is split into equal bins
 * between `min` and `max`; a value at or above `max` takes the darkest step.
 */
export function rampStep(value: number, min: number, max: number, steps = RAMP_MIX.length): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return value > min ? steps - 1 : 0;
  const t = (value - min) / (max - min);
  return Math.min(steps - 1, Math.max(0, Math.floor(t * steps)));
}

/**
 * The text colour to write on each ramp step, the same token in both themes: every pair
 * clears 4.5:1 against the step's colour on the panel surface, light and dark.
 *  - The four lighter steps sit close to the surface, so the ordinary text colour reads.
 *  - Step five is mid-blue in both themes: dark ink, which `--wp-signal-ink` is in both.
 *  - The full colour is dark on a light page and light on a dark one: the panel colour
 *    itself (white, or the dark panel) is the ink that clears it.
 */
export const RAMP_INK = [
  'var(--wp-text)',
  'var(--wp-text)',
  'var(--wp-text)',
  'var(--wp-text)',
  'var(--wp-signal-ink)',
  'var(--wp-raised)',
] as const;

/**
 * The shade of an ordered bar (a funnel step): the first is the full colour, each next one
 * lighter. Four shades at most, because only four fit between the full colour and the
 * lightest one that still stands 2:1 off the surface with lightness steps of 0.06; later
 * steps keep the lightest shade (their order is in their position and their labels).
 */
export const ORDINAL_MIX = [100, 84, 68, 52] as const;

export function ordinalShade(index: number): number {
  return Math.min(Math.max(0, index), ORDINAL_MIX.length - 1);
}

/**
 * Whether labels set at these y positions (their centres) would touch, each `height` tall.
 * Overlapping end labels are not nudged apart (that pulls them off their lines); they are
 * left out, and the legend and the tooltip name the lines instead.
 */
export function labelsCollide(positions: readonly number[], height: number): boolean {
  const sorted = [...positions].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i] as number) - (sorted[i - 1] as number) < height) return true;
  }
  return false;
}

/**
 * Roughly how wide a line of text is, in px, without a browser to measure it: digits and
 * Latin letters in the interface face average about 0.6 of the font size.
 */
export function textWidth(text: string, fontSize = 12): number {
  return Math.ceil([...text].length * fontSize * 0.6);
}

/**
 * Which labels along an axis to write so they do not run into each other: every `k`-th,
 * always including the first. `widths` are the labels' widths; `room` the space per point.
 */
export function tickEvery(widths: readonly number[], room: number, gap = 8): number {
  const widest = Math.max(0, ...widths);
  if (room <= 0) return Math.max(1, widths.length);
  return Math.max(1, Math.ceil((widest + gap) / room));
}

/**
 * Where an arrow key moves the reader along a row of points or columns. The plot runs left
 * to right in every language (time does), so Right is always "later". `null` for any other
 * key, which is then left to the browser.
 */
export function moveIndex(key: string, index: number | null, count: number): number | null {
  if (count <= 0) return null;
  const at = index ?? count - 1;
  switch (key) {
    case 'ArrowRight':
      return Math.min(count - 1, at + 1);
    case 'ArrowLeft':
      return Math.max(0, at - 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export interface Cell {
  row: number;
  col: number;
}

/**
 * Where an arrow key moves the reader across a grid of cells: one cell at a time, Home and
 * End to the ends of the row, stopping at the edges. `null` for any other key.
 */
export function moveCell(key: string, at: Cell | null, rows: number, cols: number): Cell | null {
  if (rows <= 0 || cols <= 0) return null;
  const { row, col } = at ?? { row: 0, col: 0 };
  const clamp = (r: number, c: number): Cell => ({
    row: Math.min(rows - 1, Math.max(0, r)),
    col: Math.min(cols - 1, Math.max(0, c)),
  });
  switch (key) {
    case 'ArrowRight':
      return clamp(row, col + 1);
    case 'ArrowLeft':
      return clamp(row, col - 1);
    case 'ArrowDown':
      return clamp(row + 1, col);
    case 'ArrowUp':
      return clamp(row - 1, col);
    case 'Home':
      return clamp(row, 0);
    case 'End':
      return clamp(row, cols - 1);
    default:
      return null;
  }
}

export interface FoldableSeries<V> {
  id: string;
  label: string;
  values: readonly V[];
}

/**
 * Keeps the first `max - 1` series and adds the rest together as one series named `label`,
 * so a chart never needs a fifth colour. Missing values count as nothing in the sum; a point
 * where every folded series is missing stays missing.
 */
export function foldIntoOther<S extends FoldableSeries<number | null>>(
  series: readonly S[],
  max: number,
  label: string,
): Array<S | FoldableSeries<number | null>> {
  if (series.length <= max) return [...series];
  const kept = series.slice(0, Math.max(0, max - 1));
  const rest = series.slice(Math.max(0, max - 1));
  const length = Math.max(0, ...rest.map((s) => s.values.length));
  const values = Array.from({ length }, (_, i) => {
    let sum: number | null = null;
    for (const s of rest) {
      const v = s.values[i];
      if (typeof v === 'number' && Number.isFinite(v)) sum = (sum ?? 0) + v;
    }
    return sum;
  });
  return [...kept, { id: '__other', label, values }];
}
