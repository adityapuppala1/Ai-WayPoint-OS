import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastReport, fontSize } from '../src';

describe('design tokens', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`meets WCAG 2.2 AA contrast in ${mode} mode`, () => {
      const failures = contrastReport(mode).filter((c) => !c.pass);
      expect(failures, failures.map((f) => `${f.pair} ${f.ratio} < ${f.min}`).join('\n')).toEqual(
        [],
      );
    });
  }

  it('never gives two tokens the same CSS name', () => {
    const css = readFileSync(join(__dirname, '..', 'tokens.css'), 'utf8');
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
