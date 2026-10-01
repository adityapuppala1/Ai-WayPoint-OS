/**
 * The chart kit: the arithmetic behind it, and what each chart puts on the page, rendered
 * the way the server renders it. Pointer and keyboard movement run in a browser; here the
 * steps they take (which point an arrow key reaches, which point a pointer is nearest) are
 * checked as plain functions, and the tooltip they open is checked as it draws.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BarList,
  ChartFrame,
  Funnel,
  Heatmap,
  SERIES_ORDER,
  StackedBarChart,
  StatTile,
  TimeSeriesChart,
} from '../src';
import { Readout } from '../src/components/charts/ChartFrame';
import { shareOf } from '../src/components/charts/Funnel';
import { columnPath } from '../src/components/charts/StackedBarChart';
import { deltaTone } from '../src/components/charts/StatTile';
import {
  bandAt,
  barThickness,
  foldIntoOther,
  labelsCollide,
  linear,
  moveCell,
  moveIndex,
  nearestPoint,
  niceStep,
  niceTicks,
  ORDINAL_MIX,
  ordinalShade,
  pointX,
  RAMP_INK,
  RAMP_MIX,
  rampStep,
  seriesSlot,
  tickEvery,
} from '../src/components/charts/scale';
import { lineRuns } from '../src/components/charts/TimeSeriesChart';
import { parse, type Rule } from './css';

const count = (html: string, needle: string) => html.split(needle).length - 1;

/** What a reader can see or hear: the text between tags, and the names given to elements. */
function words(html: string): string {
  const named = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
  return `${html.replace(/<[^>]*>/g, ' ')} ${named.join(' ')}`;
}

// French words and numbers throughout, so anything English the kit wrote itself shows up.
const fr = new Intl.NumberFormat('fr-FR');
const formatValue = (n: number) => fr.format(n);
const formatShare = (n: number) => `${fr.format(Math.round(n * 100))} %`;
const formatX = (x: string) => `le ${x.slice(11, 16) || x.slice(5, 10)}`;
const view = { chart: 'Graphique', table: 'Tableau', view: 'Afficher en' };

const HOURS = ['2026-09-30T10:00', '2026-09-30T11:00', '2026-09-30T12:00', '2026-09-30T13:00'];

const ENGLISH = [
  'Show',
  'Hide',
  'Table',
  'Chart',
  'Total',
  'Other',
  'No data',
  'View',
  'Legend',
  'from previous',
  'from first',
  'vs ',
];

function expectNoEnglish(html: string) {
  const text = words(html);
  // Whole words only: the French "Tableau" is not the English "Table".
  for (const word of ENGLISH)
    expect(text, word).not.toMatch(new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'u'));
}

describe('rounded ticks', () => {
  it('steps by 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.4)).toBe(2);
    expect(niceStep(2.3)).toBe(2.5);
    expect(niceStep(37)).toBe(50);
    expect(niceStep(720)).toBe(1000);
    expect(niceStep(0.032)).toBe(0.05);
  });

  it('start at zero and reach past the largest value in round steps', () => {
    expect(niceTicks(870, 4)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0.37, 4)).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
    expect(niceTicks(1, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('still draw an axis when there is nothing to show', () => {
    expect(niceTicks(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(Number.NaN)[0]).toBe(0);
  });

  it('go below zero only when a value does', () => {
    expect(niceTicks(10, 4, -3)[0]).toBeLessThan(0);
    expect(niceTicks(10, 4, 5)[0]).toBe(0);
  });
});

describe('positions', () => {
  it('maps a value onto pixels, upside down for a y axis', () => {
    const y = linear([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(150);
  });

  it('puts the first point on the start edge and the last on the end edge', () => {
    expect(pointX(0, 5, 40, 400)).toBe(40);
    expect(pointX(4, 5, 40, 400)).toBe(440);
    expect(pointX(0, 1, 40, 400)).toBe(240);
  });

  it('snaps the crosshair to the nearest point, and a column to the band under the pointer', () => {
    expect(nearestPoint(40, 5, 40, 400)).toBe(0);
    expect(nearestPoint(180, 5, 40, 400)).toBe(1);
    expect(nearestPoint(200, 5, 40, 400)).toBe(2);
    expect(nearestPoint(-50, 5, 40, 400)).toBe(0);
    expect(nearestPoint(9999, 5, 40, 400)).toBe(4);
    expect(bandAt(40, 4, 40, 400)).toBe(0);
    expect(bandAt(139, 4, 40, 400)).toBe(0);
    expect(bandAt(141, 4, 40, 400)).toBe(1);
    expect(bandAt(9999, 4, 40, 400)).toBe(3);
  });

  it('keeps columns thin: never over 24px, and always a gap of air beside them', () => {
    expect(barThickness(200)).toBe(24);
    for (const band of [3, 6, 10, 20, 30]) {
      expect(barThickness(band)).toBeLessThanOrEqual(24);
      expect(band - barThickness(band)).toBeGreaterThanOrEqual(2 - 1e-9);
    }
  });

  it('rounds a column at its top only, square where it stands', () => {
    const top = columnPath(10, 20, 100, 16, true);
    expect(top).toContain('A4 4');
    expect(top.startsWith('M10 100')).toBe(true);
    expect(columnPath(10, 20, 100, 16, false)).not.toContain('A');
    // A sliver lower than the radius is rounded only as far as it is tall.
    expect(columnPath(10, 98, 100, 16, true)).toContain('A2 2');
  });

  it('breaks a line where values are missing', () => {
    const runs = lineRuns(
      [1, 2, null, 4, null, null, 7, 8],
      (i) => i,
      (v) => v,
    );
    expect(runs.map((r) => r.length)).toEqual([2, 1, 2]);
  });
});

describe('colour', () => {
  it('hands out series colours in the order that keeps neighbours apart for everyone', () => {
    expect(SERIES_ORDER).toEqual([1, 2, 6, 5]);
    expect([0, 1, 2, 3].map((i) => seriesSlot(i))).toEqual([1, 2, 6, 5]);
    // Never cycled: past the fourth there is no new colour (the fifth is folded away).
    expect(seriesSlot(7)).toBe(5);
    expect(seriesSlot(0, 3)).toBe(3);
  });

  it('puts a value in one of six shades, the darkest at the top of the scale', () => {
    expect(RAMP_MIX).toHaveLength(6);
    expect(RAMP_INK).toHaveLength(RAMP_MIX.length);
    expect(rampStep(0, 0, 1)).toBe(0);
    expect(rampStep(0.5, 0, 1)).toBe(3);
    expect(rampStep(0.99, 0, 1)).toBe(5);
    expect(rampStep(1, 0, 1)).toBe(5);
    expect(rampStep(7, 0, 1)).toBe(5);
    expect(rampStep(-1, 0, 1)).toBe(0);
    // Steps rise in order across the scale.
    const steps = Array.from({ length: 101 }, (_, i) => rampStep(i / 100, 0, 1));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(6);
  });

  it('shades a funnel from the full colour down, and stops at the lightest that still shows', () => {
    expect(ORDINAL_MIX[0]).toBe(100);
    expect([0, 1, 2, 3, 4, 7].map(ordinalShade)).toEqual([0, 1, 2, 3, 3, 3]);
  });
});

describe('labels', () => {
  it('sees when end labels would run into each other', () => {
    expect(labelsCollide([10, 40, 80], 15)).toBe(false);
    expect(labelsCollide([10, 80, 20], 15)).toBe(true);
    expect(labelsCollide([50], 15)).toBe(false);
  });

  it('writes every k-th axis label so they never touch', () => {
    expect(tickEvery([30, 30, 30], 100)).toBe(1);
    expect(tickEvery([30, 30, 30], 20)).toBe(2);
    expect(tickEvery([40, 40], 10)).toBe(5);
  });
});

describe('keyboard', () => {
  it('moves along the points with the arrow keys, Home and End, stopping at the ends', () => {
    expect(moveIndex('ArrowRight', 0, 5)).toBe(1);
    expect(moveIndex('ArrowLeft', 0, 5)).toBe(0);
    expect(moveIndex('ArrowRight', 4, 5)).toBe(4);
    expect(moveIndex('Home', 3, 5)).toBe(0);
    expect(moveIndex('End', 0, 5)).toBe(4);
    // Arriving from nowhere starts at the latest point, the one people look for.
    expect(moveIndex('ArrowLeft', null, 5)).toBe(3);
    expect(moveIndex('Tab', 2, 5)).toBeNull();
    expect(moveIndex('ArrowRight', 0, 0)).toBeNull();
  });

  it('moves across a grid of cells in four directions', () => {
    expect(moveCell('ArrowRight', { row: 0, col: 0 }, 3, 4)).toEqual({ row: 0, col: 1 });
    expect(moveCell('ArrowDown', { row: 0, col: 1 }, 3, 4)).toEqual({ row: 1, col: 1 });
    expect(moveCell('ArrowUp', { row: 0, col: 1 }, 3, 4)).toEqual({ row: 0, col: 1 });
    expect(moveCell('End', { row: 2, col: 0 }, 3, 4)).toEqual({ row: 2, col: 3 });
    expect(moveCell('Home', { row: 2, col: 3 }, 3, 4)).toEqual({ row: 2, col: 0 });
    expect(moveCell('ArrowDown', { row: 2, col: 0 }, 3, 4)).toEqual({ row: 2, col: 0 });
    expect(moveCell('Enter', { row: 0, col: 0 }, 3, 4)).toBeNull();
  });
});

describe('folding series', () => {
  it('keeps three series and adds the rest together as the fourth', () => {
    const series = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
      id,
      label: id.toUpperCase(),
      values: [i, i === 4 ? null : 1],
    }));
    const folded = foldIntoOther(series, 4, 'Autres');
    expect(folded.map((s) => s.label)).toEqual(['A', 'B', 'C', 'Autres']);
    expect(folded[3]?.values).toEqual([3 + 4, 1]);
    expect(foldIntoOther(series.slice(0, 3), 4, 'Autres')).toHaveLength(3);
  });
});

describe('ChartFrame', () => {
  const table = {
    head: ['Heure', 'Requêtes'],
    rows: [
      { id: 'a', cells: ['10 h', '1 200'] },
      { id: 'b', cells: ['11 h', '980'] },
    ],
  };

  it('is a figure named by its title, with the chart / table switch in the caller’s words', () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="Requêtes par heure" labels={view} table={table}>
        <svg />
      </ChartFrame>,
    );
    expect(html).toMatch(/^<figure /);
    expect(html).toMatch(/<h3 id="([^"]+)"[^>]*>Requêtes par heure<\/h3>/);
    const id = /<h3 id="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`aria-labelledby="${id}"`);
    expect(html).toContain('Graphique');
    expect(html).toContain('Tableau');
    expect(html).toContain('aria-label="Afficher en"');
    expectNoEnglish(html);
  });

  it('shows the same numbers as a real table, with a caption and headers in scope', () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="Requêtes" labels={view} table={table} defaultView="table">
        <svg />
      </ChartFrame>,
    );
    expect(html).toContain('<table');
    expect(html).toMatch(/<caption[^>]*>Requêtes<\/caption>/);
    expect(count(html, 'scope="col"')).toBe(2);
    expect(count(html, 'scope="row"')).toBe(2);
    for (const cell of ['10 h', '1 200', '11 h', '980']) expect(html).toContain(cell);
    expect(html).not.toContain('<svg');
  });

  it('keeps the old picture, faded and marked busy, while new numbers load', () => {
    const html = renderToStaticMarkup(
      <ChartFrame title="Requêtes" labels={view} table={table} pending>
        <svg data-old="yes" />
      </ChartFrame>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-pending="true"');
    expect(html).toContain('data-old="yes"');
  });

  it('shows a legend for two series or more, and none for one', () => {
    const two = renderToStaticMarkup(
      <ChartFrame
        title="t"
        labels={view}
        table={table}
        legend={[
          { id: 'a', label: 'Succès', colour: 'var(--wp-series-1)' },
          { id: 'b', label: 'Erreurs', colour: 'var(--wp-series-2)' },
        ]}
      >
        <svg />
      </ChartFrame>,
    );
    expect(two).toContain('<ul role="list"');
    expect(two).toContain('Succès');
    const one = renderToStaticMarkup(
      <ChartFrame
        title="t"
        labels={view}
        table={table}
        legend={[{ id: 'a', label: 'Succès', colour: 'var(--wp-series-1)' }]}
      >
        <svg />
      </ChartFrame>,
    );
    expect(one).not.toContain('Succès');
  });
});

describe('the tooltip', () => {
  it('lists every series, the number first and the name after it, keyed by a short line', () => {
    const html = renderToStaticMarkup(
      <Readout
        title="le 12:00"
        x={300}
        plotWidth={400}
        rows={[
          { id: 'a', colour: 'var(--wp-series-1)', value: '1 200', label: 'Succès' },
          { id: 'b', colour: 'var(--wp-series-2)', value: '45', label: 'Erreurs' },
          { id: 't', value: '1 245', label: 'Total' },
        ]}
      />,
    );
    expect(html).toContain('le 12:00');
    expect(count(html, '<li')).toBe(3);
    expect(html.indexOf('1 200')).toBeLessThan(html.indexOf('Succès'));
    expect(html).toMatch(/<strong[^>]*>1 200<\/strong>/);
    expect(count(html, '--key:var(--wp-series-')).toBe(2);
    // Past the middle, it opens towards the start so it does not run off the plot.
    expect(html).toContain('readoutFlip');
    expect(html).toContain('--x:300px');
    expect(html).toContain('--plot:400px');
  });
});

describe('TimeSeriesChart', () => {
  const series = [
    { id: 'ok', label: 'Succès', values: [1200, 1350, null, 1500] },
    { id: 'err', label: 'Erreurs', values: [12, 40, 8, 9] },
  ];
  const render = (props: Partial<Parameters<typeof TimeSeriesChart>[0]> = {}) =>
    renderToStaticMarkup(
      <TimeSeriesChart
        title="Requêtes par heure"
        x={HOURS}
        series={series}
        formatX={formatX}
        formatValue={formatValue}
        labels={{ ...view, x: 'Heure', noData: 'aucune donnée' }}
        {...props}
      />,
    );

  it('puts every value in the table, missing ones in the caller’s words', () => {
    const html = render({ defaultView: 'table' });
    for (const s of series)
      for (const v of s.values) expect(html).toContain(v === null ? 'aucune donnée' : fr.format(v));
    for (const x of HOURS) expect(html).toContain(formatX(x));
    expect(html).toContain('<th scope="col"');
    expect(html).toContain('Heure');
  });

  it('draws a 2px line per series, with a legend of line keys, and names the lines at their ends', () => {
    const html = render();
    expect(count(html, '<path')).toBeGreaterThanOrEqual(2);
    expect(html).toContain('keyLine');
    expect(html).toContain('color:var(--wp-series-1)');
    expect(html).toContain('color:var(--wp-series-2)');
    expect(html).toMatch(/<text[^>]*endLabel[^>]*>Erreurs<\/text>/);
  });

  it('has no legend for a single series, and labels its last value instead of its name', () => {
    const html = render({ series: [series[1] as (typeof series)[number]], variant: 'area' });
    expect(html).not.toContain('keyLine');
    expect(html).not.toContain('keyRect');
    expect(html).toMatch(/<text[^>]*endLabel[^>]*>9<\/text>/);
    expect(html).toContain('area');
  });

  it('greys every series but the one that matters, which takes the first colour', () => {
    const html = render({ emphasis: 'err' });
    expect(html).toContain('color:var(--chart-muted)');
    expect(html).toContain('color:var(--wp-series-1)');
    expect(html).not.toContain('color:var(--wp-series-2)');
  });

  it('folds a fifth series into the caller’s "other", in grey', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
      id,
      label: `Série ${id}`,
      values: [1, 2, 3, 4],
    }));
    const html = render({ series: five, labels: { ...view, x: 'Heure', other: 'Autres' } });
    expect(html).toContain('Autres');
    expect(html).not.toContain('Série d');
    expect(html).toContain('var(--chart-muted)');
  });

  it('is one stop for the keyboard, named, running left to right, with an empty live tooltip', () => {
    const html = render({ ariaLabel: 'Requêtes en hausse depuis 10 h' });
    expect(html).toMatch(/<div[^>]*dir="ltr"[^>]*role="group"[^>]*tabindex="0"/);
    expect(html).toContain('aria-label="Requêtes en hausse depuis 10 h"');
    expect(html).toMatch(/<div[^>]*role="status"[^>]*><\/div>/);
    expect(html).toContain('aria-hidden="true"');
  });

  it('has rounded ticks from zero and solid hairline grid (never dashed)', () => {
    const html = render();
    expect(html).toContain('>0</text>');
    expect(html).toContain(`>${fr.format(1500)}</text>`);
    expect(html).not.toContain('dasharray');
  });

  it('writes nothing in English of its own', () => {
    expectNoEnglish(render());
    expectNoEnglish(render({ defaultView: 'table' }));
  });
});

describe('StackedBarChart', () => {
  const series = [
    { id: 'web', label: 'Web', values: [30, 42, 0, 55] },
    { id: 'app', label: 'Appli', values: [12, null, 5, 20] },
  ];
  const render = (props: Partial<Parameters<typeof StackedBarChart>[0]> = {}) =>
    renderToStaticMarkup(
      <StackedBarChart
        title="Inscriptions par jour"
        x={HOURS}
        series={series}
        formatX={formatX}
        formatValue={formatValue}
        labels={{ ...view, x: 'Jour', total: 'Ensemble' }}
        {...props}
      />,
    );

  it('puts every part and each column’s total in the table', () => {
    const html = render({ defaultView: 'table' });
    expect(html).toContain('Ensemble');
    for (const total of ['42', '42', '5', '75']) expect(html).toContain(`>${total}<`);
    expect(html).toContain('—');
  });

  it('stacks the series with a legend of blocks, and rounds only the top of each column', () => {
    const html = render();
    expect(html).toContain('keyRect');
    // Two drawn segments in three columns, one in the column where the app had none.
    const bars = [...html.matchAll(/<path class="[^"]*bar[^"]*"[^>]*d="([^"]+)"/g)];
    expect(bars.length).toBe(6);
    expect(bars.filter((b) => (b[1] ?? '').includes('A')).length).toBe(4);
  });

  it('is plain columns, without a legend, for one series', () => {
    const html = render({ series: [series[0] as (typeof series)[number]] });
    expect(html).not.toContain('keyRect');
    expect(html).not.toContain('Ensemble');
  });

  it('writes nothing in English of its own', () => {
    expectNoEnglish(render());
    expectNoEnglish(render({ defaultView: 'table' }));
  });
});

describe('BarList', () => {
  const items = [
    { id: 'plans', label: '/v1/plans', value: 5400, note: 'p95 840 ms' },
    { id: 'ask', label: '/v1/ask', value: 2700 },
    { id: 'none', label: '/v1/rien', value: 0 },
  ];
  const labels = { ...view, category: 'Route', value: 'Requêtes' };

  it('ranks the categories in one colour, each value written at its bar’s end', () => {
    const html = renderToStaticMarkup(
      <BarList title="Routes" items={items} formatValue={formatValue} labels={labels} />,
    );
    expect(html).toContain('<ol role="list"');
    for (const item of items) {
      expect(html).toContain(item.label);
      expect(html).toContain(formatValue(item.value));
    }
    expect(html).toContain('--share:1');
    expect(html).toContain('--share:0.5');
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('p95 840 ms');
    // Plain rows: the only buttons are the chart / table switch.
    expect(html.slice(html.indexOf('<ol'))).not.toContain('<button');
  });

  it('makes each row a button when a category can be picked', () => {
    const html = renderToStaticMarkup(
      <BarList title="Routes" items={items} labels={labels} onSelect={() => {}} />,
    );
    expect(count(html.slice(html.indexOf('<ol')), '<button type="button"')).toBe(3);
  });

  it('puts every value in the table, and writes nothing in English of its own', () => {
    const html = renderToStaticMarkup(
      <BarList
        title="Routes"
        items={items}
        formatValue={formatValue}
        labels={labels}
        defaultView="table"
      />,
    );
    for (const item of items) expect(html).toContain(formatValue(item.value));
    expectNoEnglish(html);
  });
});

describe('Heatmap', () => {
  const rows = ['Sem. 1', 'Sem. 2', 'Sem. 3'];
  const cols = ['0', '1', '2'];
  const values = [
    [1, 0.42, 0.3],
    [1, 0.51, null],
    [1, null, null],
  ];
  const render = (props: Partial<Parameters<typeof Heatmap>[0]> = {}) =>
    renderToStaticMarkup(
      <Heatmap
        title="Rétention par cohorte"
        rows={rows}
        cols={cols}
        values={values}
        formatValue={formatShare}
        formatCol={(c) => `Semaine ${c}`}
        labels={{ ...view, rows: 'Cohorte', scale: 'Part encore active', noData: 'sans données' }}
        {...props}
      />,
    );

  it('shades each cell by its value and leaves cells with no data empty', () => {
    const html = render();
    expect(count(html, 'step5')).toBeGreaterThanOrEqual(3);
    expect(count(html, 'cellEmpty')).toBe(3);
    // A scale reads the shades: six of them between the two ends.
    expect(html).toContain('Part encore active');
    expect(html).toContain(formatShare(0));
    expect(html).toContain(formatShare(1));
  });

  it('writes values in the cells only when asked, in an ink that reads on the shade', () => {
    expect(render()).not.toContain('cellValue');
    const html = render({ showValues: true });
    expect(html).toContain('cellValue');
    expect(html).toContain('fill:var(--wp-raised)');
  });

  it('puts every value in the table, with the column names in full', () => {
    const html = render({ defaultView: 'table' });
    expect(html).toContain('Cohorte');
    expect(html).toContain('Semaine 2');
    for (const v of [1, 0.42, 0.3, 0.51]) expect(html).toContain(formatShare(v));
    expect(count(html, 'sans données')).toBe(3);
  });

  it('writes nothing in English of its own', () => {
    expectNoEnglish(render());
    expectNoEnglish(render({ defaultView: 'table' }));
  });
});

describe('Funnel', () => {
  const steps = [
    { id: 'visit', label: 'Visite', value: 1000 },
    { id: 'signup', label: 'Inscription', value: 400 },
    { id: 'setup', label: 'Configuration', value: 300 },
    { id: 'return', label: 'Retour', value: 150 },
    { id: 'paid', label: 'Abonnement', value: 30 },
  ];
  const labels = {
    ...view,
    step: 'Étape',
    value: 'Personnes',
    fromPrevious: 'de l’étape précédente',
    fromFirst: 'de la première',
  };

  it('shows each step’s count and the share kept from the step before and from the first', () => {
    const html = renderToStaticMarkup(
      <Funnel
        title="Parcours"
        steps={steps}
        formatValue={formatValue}
        formatShare={formatShare}
        labels={labels}
      />,
    );
    for (const s of steps) expect(html).toContain(formatValue(s.value));
    expect(html).toContain(formatShare(0.4)); // 400 of 1000
    expect(html).toContain(formatShare(0.75)); // 300 of 400
    expect(html).toContain(formatShare(0.03)); // 30 of 1000
    // One hue, lighter at each step; the fifth keeps the lightest shade.
    for (const shade of ['shade0', 'shade1', 'shade2', 'shade3']) expect(html).toContain(shade);
    expect(count(html, 'shade3')).toBe(2);
  });

  it('does not divide by nothing', () => {
    expect(shareOf(5, 0)).toBeNull();
    expect(shareOf(5, undefined)).toBeNull();
    expect(shareOf(5, 10)).toBe(0.5);
  });

  it('puts every number in the table, and writes nothing in English of its own', () => {
    const html = renderToStaticMarkup(
      <Funnel
        title="Parcours"
        steps={steps}
        formatValue={formatValue}
        formatShare={formatShare}
        labels={labels}
        defaultView="table"
      />,
    );
    expect(count(html, '<tr')).toBe(steps.length + 1);
    expect(html).toContain(formatShare(0.5)); // 150 of 300
    expectNoEnglish(html);
  });
});

describe('StatTile', () => {
  it('says which way a change went with an arrow and words, coloured by whether it is good', () => {
    const html = renderToStaticMarkup(
      <StatTile
        label="Personnes actives par jour"
        value="1 284"
        delta={{ text: '+12 %', period: 'par rapport à la semaine dernière', direction: 'up' }}
        trend={{ values: [1, 3, 2, 5], label: 'En hausse sur quatre semaines' }}
      />,
    );
    expect(html).toContain('1 284');
    expect(html).toContain('+12 %');
    expect(html).toContain('par rapport à la semaine dernière');
    expect(html).toContain('data-tone="good"');
    expect(html).toContain('aria-label="En hausse sur quatre semaines"');
    expect(count(html, '<svg')).toBe(2);
    expectNoEnglish(html);
  });

  it('knows that more is worse for some numbers, and that some are just numbers', () => {
    expect(deltaTone({ direction: 'up' })).toBe('good');
    expect(deltaTone({ direction: 'up', good: 'down' })).toBe('bad');
    expect(deltaTone({ direction: 'down', good: 'down' })).toBe('good');
    expect(deltaTone({ direction: 'down', good: 'neither' })).toBe('neutral');
    expect(deltaTone({ direction: 'flat' })).toBe('neutral');
  });
});

describe('the chart stylesheet', () => {
  // charts.module.css sits in a folder of its own, so it is held here to the same rules
  // styles.test.ts holds every other stylesheet to.
  const rules = parse('components/charts/charts.module.css').filter(
    (r) => !r.within.some((w) => w.startsWith('@keyframes')),
  );
  const where = (r: Rule) => r.selector;

  it('uses no physical sides, so Arabic mirrors', () => {
    const physical = rules
      .flatMap((r) => r.declarations.map((d) => ({ r, d })))
      .filter(
        ({ d }) =>
          /(^|-)(left|right)$/.test(d.prop) ||
          /^(margin|padding|border)-(left|right)/.test(d.prop) ||
          (/^(text-align|float|clear)$/.test(d.prop) && /^(left|right)$/.test(d.value)),
      )
      .map(({ r, d }) => `${where(r)} { ${d.prop} }`);
    expect(physical).toEqual([]);
  });

  it('hovers only where a pointer can, and focuses with the one focus token', () => {
    expect(
      rules
        .filter((r) => /:hover/.test(r.selector))
        .filter((r) => !r.within.includes('@media (hover: hover)'))
        .map(where),
    ).toEqual([]);
    const focus = rules.filter((r) => /focus-visible/.test(r.selector));
    expect(focus.length).toBeGreaterThan(0);
    for (const r of focus)
      expect(
        r.declarations.some((d) => d.prop === 'box-shadow' && d.value === 'var(--wp-focus-shadow)'),
        where(r),
      ).toBe(true);
  });

  it('keeps a plain colour beside every color-mix(), for browsers without it', () => {
    const guard = '@supports (color: color-mix(in oklch, red, blue))';
    const problems: string[] = [];
    for (const r of rules) {
      for (const d of r.declarations) {
        if (!d.value.includes('color-mix(')) continue;
        const fallback = rules.some(
          (o) =>
            o.selector === r.selector &&
            !o.within.includes(guard) &&
            o.declarations.some((x) => x.prop === d.prop && !x.value.includes('color-mix(')),
        );
        if (!r.within.includes(guard) || !fallback) problems.push(`${r.selector} { ${d.prop} }`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('draws gridlines solid, and never forces motion past the switches that stop it', () => {
    const all = rules.flatMap((r) => r.declarations);
    expect(all.some((d) => d.prop === 'stroke-dasharray')).toBe(false);
    expect(
      all.filter((d) => /^(animation|transition)/.test(d.prop) && d.value.includes('!important')),
    ).toEqual([]);
  });
});
