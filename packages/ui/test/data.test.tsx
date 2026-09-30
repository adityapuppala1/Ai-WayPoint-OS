/**
 * Small figures drawn without a chart library: a line of values, a ring, a number that
 * counts. Each says in words what it draws. Rendered the way the server renders them; the
 * counting itself runs in a browser and is checked in apps/web/e2e/design.spec.ts.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedNumber, countAt, ProgressRing, Sparkline, stillnessPreferred } from '../src';

const count = (html: string, needle: string) => html.split(needle).length - 1;

/** The points of the line, as [x, y] pairs. */
const points = (html: string) =>
  (/ points="([^"]*)"/.exec(html)?.[1] ?? '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p.split(',').map(Number) as [number, number]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sparkline', () => {
  it('says in words what the line shows', () => {
    const html = renderToStaticMarkup(
      <Sparkline values={[3, 4, 4, 5]} label="Savings runway, last four weeks: 3 to 5 weeks" />,
    );
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Savings runway, last four weeks: 3 to 5 weeks"');
  });

  it('draws one point for each value, oldest on the left, higher values higher up', () => {
    const line = points(renderToStaticMarkup(<Sparkline values={[1, 3, 2]} label="x" />));
    expect(line).toHaveLength(3);
    const [a, b, c] = line as [[number, number], [number, number], [number, number]];
    expect(a[0]).toBeLessThan(b[0]);
    expect(b[0]).toBeLessThan(c[0]);
    // In SVG, y grows downwards: the largest value has the smallest y.
    expect(b[1]).toBeLessThan(c[1]);
    expect(c[1]).toBeLessThan(a[1]);
  });

  it('marks the last value with a dot, inside the drawing', () => {
    const html = renderToStaticMarkup(
      <Sparkline values={[1, 3, 2]} label="x" width={96} height={28} />,
    );
    const last = points(html).at(-1);
    expect(html).toContain(`<circle cx="${last?.[0]}" cy="${last?.[1]}"`);
    expect(last?.[0]).toBeLessThan(96);
    expect(html).toContain('viewBox="0 0 96 28"');
  });

  it('draws a level line when nothing changed, and just the dot for a single value', () => {
    const level = points(renderToStaticMarkup(<Sparkline values={[5, 5, 5]} label="x" />));
    expect(new Set(level.map(([, y]) => y)).size).toBe(1);
    const one = renderToStaticMarkup(<Sparkline values={[5]} label="x" />);
    expect(one).not.toContain('<polyline');
    expect(count(one, '<circle')).toBe(1);
  });

  it('draws nothing when there is nothing to draw, and skips values that are not numbers', () => {
    expect(renderToStaticMarkup(<Sparkline values={[]} label="x" />)).toBe('');
    expect(
      points(renderToStaticMarkup(<Sparkline values={[1, Number.NaN, 2]} label="x" />)),
    ).toHaveLength(2);
  });

  it('takes its colour from the text around it, or from a module line or a chart series', () => {
    const plain = renderToStaticMarkup(<Sparkline values={[1, 2]} label="x" />);
    expect(plain).toContain('stroke="currentColor"');
    expect(plain).not.toContain('--wp-');
    expect(renderToStaticMarkup(<Sparkline values={[1, 2]} label="x" module="money" />)).toContain(
      'color:var(--wp-line-money)',
    );
    expect(renderToStaticMarkup(<Sparkline values={[1, 2]} label="x" series={3} />)).toContain(
      'color:var(--wp-series-3)',
    );
  });
});

describe('ProgressRing', () => {
  it('is a meter with a name, its value and the same value in words', () => {
    const html = renderToStaticMarkup(
      <ProgressRing value={3} total={5} label="Steps done this week" valueText="3 of 5" />,
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-label="Steps done this week"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="5"');
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-valuetext="3 of 5"');
    // The number is in the middle for everyone who sees the ring.
    expect(html).toMatch(/>3 of 5<\/span>/);
    // 3 of 5 is 60 of the ring's 100 parts.
    expect(html).toContain('stroke-dasharray="60 100"');
  });

  it('shows a percentage when it is not told how to write the value', () => {
    const html = renderToStaticMarkup(<ProgressRing value={0.25} total={1} label="Done" />);
    expect(html).toContain('aria-valuetext="25%"');
    expect(html).toContain('stroke-dasharray="25 100"');
  });

  it('draws no arc at nothing, and a whole ring at the total or beyond', () => {
    const none = renderToStaticMarkup(<ProgressRing value={0} total={5} label="Done" />);
    expect(count(none, '<circle')).toBe(1);
    const over = renderToStaticMarkup(<ProgressRing value={7} total={5} label="Done" />);
    expect(over).toContain('stroke-dasharray="100 100"');
    expect(over).toContain('aria-valuenow="5"');
  });
});

describe('AnimatedNumber', () => {
  const format = (n: number) => `${Math.round(n)} weeks`;

  it('is drawn on the server as the number itself, written by the formatter it was given', () => {
    const html = renderToStaticMarkup(<AnimatedNumber value={5} format={format} />);
    expect(html).toContain('5 weeks');
    expect(count(html, '5 weeks')).toBe(1);
    // Nothing is hidden from anyone while the number stands still.
    expect(html).not.toContain('aria-hidden');
  });

  it('draws the number it will arrive at, even when told where to start counting from', () => {
    // Without scripts the page must show the real figure, never the starting one.
    const html = renderToStaticMarkup(<AnimatedNumber value={5} from={0} format={format} />);
    expect(html).toContain('5 weeks');
    expect(html).not.toContain('0 weeks');
  });

  it('writes digits the way the formatter writes them (Arabic, Hindi)', () => {
    const arabic = new Intl.NumberFormat('ar-EG');
    const hindi = new Intl.NumberFormat('hi-IN-u-nu-deva');
    expect(
      renderToStaticMarkup(<AnimatedNumber value={42} format={(n) => arabic.format(n)} />),
    ).toContain('٤٢');
    expect(
      renderToStaticMarkup(<AnimatedNumber value={42} format={(n) => hindi.format(n)} />),
    ).toContain('४२');
  });
});

describe('counting', () => {
  it('starts at the old number, ends exactly on the new one, and slows as it arrives', () => {
    expect(countAt(10, 20, 0)).toBe(10);
    expect(countAt(10, 20, 1)).toBe(20);
    expect(countAt(0.1, 0.3, 1)).toBe(0.3);
    const half = countAt(0, 100, 0.5);
    expect(half).toBeGreaterThan(50);
    expect(half).toBeLessThan(100);
    // Counting down works the same way.
    expect(countAt(20, 10, 0.5)).toBeLessThan(15);
    // Progress outside 0..1 never overshoots.
    expect(countAt(0, 100, 1.5)).toBe(100);
    expect(countAt(0, 100, -1)).toBe(0);
  });
});

describe('stillnessPreferred', () => {
  const page = (lite: boolean, reduced: boolean) => {
    vi.stubGlobal('document', {
      documentElement: {
        getAttribute: (name: string) => (name === 'data-lite' && lite ? 'true' : null),
      },
    });
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: reduced, media: query }),
    });
  };

  it('is true on the server, where nothing moves', () => {
    expect(stillnessPreferred()).toBe(true);
  });

  it('is true in lite mode and when the device asks for less motion, false otherwise', () => {
    page(false, false);
    expect(stillnessPreferred()).toBe(false);
    page(true, false);
    expect(stillnessPreferred()).toBe(true);
    page(false, true);
    expect(stillnessPreferred()).toBe(true);
  });
});
