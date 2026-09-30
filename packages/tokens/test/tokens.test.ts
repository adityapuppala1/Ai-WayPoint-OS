import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contrast,
  contrastReport,
  dark,
  elevation,
  focus,
  fontSize,
  light,
  MODULE_LINES,
  motion,
  type Oklch,
  signEdge,
} from '../src';

const css = readFileSync(join(__dirname, '..', 'tokens.css'), 'utf8');

/** The alpha of every layer in a shadow, e.g. "0 1px 2px rgb(16 24 40 / 0.06), …" → [0.06, …]. */
const alphas = (shadow: string) =>
  [...shadow.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
/** Layers that fall outside the box (not the inset highlight the dark theme adds). */
const outerLayers = (shadow: string) =>
  shadow.split(/,(?![^(]*\))/).filter((layer) => !layer.trim().startsWith('inset'));

describe('design tokens', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`meets WCAG 2.2 AA contrast in ${mode} mode`, () => {
      const failures = contrastReport(mode).filter((c) => !c.pass);
      expect(failures, failures.map((f) => `${f.pair} ${f.ratio} < ${f.min}`).join('\n')).toEqual(
        [],
      );
    });

    it(`checks text on overlays, the Sign against the page and the marker in ${mode} mode`, () => {
      const pairs = contrastReport(mode).map((c) => c.pair);
      for (const pair of [
        'text / overlay',
        'textSecondary / overlay',
        'textMuted / overlay',
        'danger / overlay',
        'sign / canvas',
        'marker / canvas',
        'marker / raised',
        'focus / canvas',
        'focus / raised',
        'focus / overlay',
        'focus / sign',
      ])
        expect(pairs, pair).toContain(pair);
    });

    it(`checks a module page's header band in ${mode} mode: its text and its mark`, () => {
      // PageHeader lays a module's tint over the page and puts the h1, the lead and the
      // module's mark (its line colour, filled) on it.
      const report = contrastReport(mode);
      const modules = [...Object.keys(MODULE_LINES), 'support'];
      for (const m of modules) {
        for (const [pair, min] of [
          [`text / band:${m}`, 4.5],
          [`textSecondary / band:${m}`, 4.5],
          [`line:${m} / band:${m}`, 3],
          [`raised / line:${m}`, 3],
        ] as const) {
          const check = report.find((c) => c.pair === pair);
          expect(check, pair).toBeDefined();
          expect(check?.min, pair).toBe(min);
        }
      }
    });

    it(`keeps the Sign the boldest thing on the page in ${mode} mode`, () => {
      const r = mode === 'light' ? light : dark;
      // A UI graphic needs 3:1 against what it sits on; a panel is nowhere near that.
      expect(contrast(r.sign, r.canvas)).toBeGreaterThanOrEqual(3);
      expect(contrast(r.sign, r.canvas)).toBeGreaterThan(contrast(r.raised, r.canvas) * 2);
    });

    it(`shows the focus ring on every surface in ${mode} mode`, () => {
      const r = mode === 'light' ? light : dark;
      // The ring and the halo are two colours so that one of them always stands out.
      const seen = (surface: Oklch, ring: Oklch) =>
        Math.max(contrast(ring, surface), contrast(r.signal, surface));
      for (const surface of [r.canvas, r.raised, r.sunken, r.overlay])
        expect(seen(surface, r.focusRing)).toBeGreaterThanOrEqual(3);
      expect(seen(r.sign, r.signText)).toBeGreaterThanOrEqual(3);
    });
  }

  it('separates canvas, raised and overlay in the dark', () => {
    // Before the rebuild each step was 1.08:1 and panels were told apart by a hairline only.
    expect(contrast(dark.raised, dark.canvas)).toBeGreaterThanOrEqual(1.15);
    expect(contrast(dark.overlay, dark.raised)).toBeGreaterThanOrEqual(1.15);
    expect(dark.sunken.l).toBeLessThan(dark.canvas.l);
    expect(dark.canvas.l).toBeLessThan(dark.raised.l);
    expect(dark.raised.l).toBeLessThan(dark.overlay.l);
  });

  it('gives three elevation steps, each stronger than the last, in light and dark', () => {
    for (const mode of ['light', 'dark'] as const) {
      const steps = [elevation[mode][1], elevation[mode][2], elevation[mode][3]];
      const strongest = steps.map((s) => Math.max(...outerLayers(s).flatMap(alphas)));
      expect(strongest[0]).toBeLessThan(strongest[1] as number);
      expect(strongest[1]).toBeLessThan(strongest[2] as number);
    }
    // Panels: a tight contact shadow plus a soft ambient one. Soft, never heavy.
    expect(outerLayers(elevation.light[1])).toHaveLength(2);
    expect(Math.max(...alphas(elevation.light[1]))).toBeLessThanOrEqual(0.08);
    expect(Math.max(...alphas(elevation.light[3]))).toBeLessThanOrEqual(0.16);
  });

  it('draws focus as a 2px ring and a 3px signal halo, outside or inside the control', () => {
    expect(focus.ring).toBe(2);
    expect(focus.halo).toBe(3);
    expect(focus.shadow).toBe('0 0 0 2px var(--wp-focus-ring), 0 0 0 5px var(--wp-signal)');
    expect(focus.shadowInset).toBe(
      'inset 0 0 0 2px var(--wp-focus-ring), inset 0 0 0 5px var(--wp-signal)',
    );
    // Inside the Sign (and a toast) the ring takes the Sign's own text colour.
    expect(focus.shadowOnSign).toBe('0 0 0 2px var(--wp-sign-text), 0 0 0 5px var(--wp-signal)');
  });

  it('gives the Sign a wider signal edge in the dark', () => {
    expect(signEdge.dark).toBeGreaterThan(signEdge.light);
  });

  it('gives hover and pressed fills as plain see-through colours, pressed the stronger', () => {
    // Ready-made, so components need no color-mix() (older Safari and Firefox lack it).
    for (const r of [light, dark]) {
      for (const [hover, pressed] of [
        [r.fillHover, r.fillPressed],
        [r.signFillHover, r.signFillPressed],
      ] as const) {
        expect(hover.a).toBeGreaterThan(0);
        expect(pressed.a ?? 1).toBeGreaterThan(hover.a ?? 1);
        expect(pressed.a).toBeLessThanOrEqual(0.2);
      }
      // The fills are the text colour thinned out, so they work on any surface.
      expect({ ...r.fillHover, a: undefined }).toEqual({ ...r.text, a: undefined });
      expect({ ...r.signFillHover, a: undefined }).toEqual({ ...r.signText, a: undefined });
      expect(r.signBorder.a).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('keeps motion short, with one longer moment for the route', () => {
    for (const d of [motion.instant, motion.fast, motion.base, motion.slow])
      expect(d).toBeLessThanOrEqual(240);
    expect(motion.fast).toBe(120);
    expect(motion.route).toBeGreaterThanOrEqual(400);
    expect(motion.route).toBeLessThanOrEqual(600);
    expect(motion.pressScale).toBeGreaterThanOrEqual(0.95);
    expect(motion.pressScale).toBeLessThan(1);
  });

  it('writes the new tokens into the stylesheet for light and both dark blocks', () => {
    for (const name of [
      '--wp-focus-shadow',
      '--wp-focus-shadow-inset',
      '--wp-focus-shadow-on-sign',
      '--wp-duration-route',
      '--wp-ease-route',
      '--wp-press-scale',
    ])
      expect(css.split(`${name}:`).length - 1, name).toBe(1);
    for (const name of [
      '--wp-shadow-1',
      '--wp-shadow-2',
      '--wp-shadow-3',
      '--wp-marker',
      '--wp-sign-edge',
      '--wp-fill-hover',
      '--wp-fill-pressed',
      '--wp-sign-fill-hover',
      '--wp-sign-fill-pressed',
      '--wp-sign-border',
    ])
      expect(css.split(`${name}:`).length - 1, name).toBe(3);
    // The old names stay for the pages that use them, pointing at the scale.
    expect(css).toContain('--wp-shadow-raised: var(--wp-shadow-1);');
    expect(css).toContain('--wp-shadow-overlay: var(--wp-shadow-3);');
  });

  it('never gives two tokens the same CSS name', () => {
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const names = [...root.matchAll(/(--wp-[\w-]+):/g)].map((m) => m[1]);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it('keeps meta text at 12px and body at 16px', () => {
    expect(fontSize.meta * 16).toBe(12);
    expect(fontSize.body * 16).toBe(16);
  });
});
