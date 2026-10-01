/**
 * The parts a module page is built from (its header, the stats strip, "also on Waypoint"),
 * rendered the way the server renders them. How they look and move in a browser is checked
 * in apps/web/e2e/design.spec.ts.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, NextStops, PageHeader, Stat, StatStrip } from '../src';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('PageHeader', () => {
  it('holds the page heading, the lead and the module mark on a band in the module tint', () => {
    const html = renderToStaticMarkup(
      <PageHeader module="money" title="Money" lead="Budget, runway and money safety." />,
    );
    expect(html).toMatch(/^<header /);
    expect(html).toMatch(/<h1[^>]*>Money<\/h1>/);
    expect(count(html, '<h1')).toBe(1);
    expect(html).toContain('Budget, runway and money safety.');
    // The band takes the tint, the mark takes the line: both from the module's own tokens.
    expect(html).toContain('--tint:var(--wp-tint-money)');
    expect(html).toContain('--line:var(--wp-line-money)');
    // The mark is a picture of the module beside its name, so it says nothing by itself.
    expect(count(html, '<svg')).toBe(1);
    expect(html).toContain('aria-hidden="true"');
  });

  it('leaves out what it was not given', () => {
    const html = renderToStaticMarkup(<PageHeader module="path" title="Your path" />);
    expect(html).not.toMatch(/<p[ >]/);
    expect(html).not.toContain('actions');
  });

  it('puts the actions for the whole page in the band, and names the heading when asked', () => {
    const html = renderToStaticMarkup(
      <PageHeader
        module="goals"
        id="goals-title"
        title="Goals"
        actions={<Button variant="primary">Add a goal</Button>}
      />,
    );
    expect(html).toContain('<h1 id="goals-title"');
    expect(html).toMatch(/actions[^>]*>.*Add a goal/);
  });

  it('uses the calm harbour blue for the help pages, which have no line of their own', () => {
    const html = renderToStaticMarkup(<PageHeader module="support" title="Get help" />);
    expect(html).toContain('--tint:var(--wp-support-tint)');
    expect(html).toContain('--line:var(--wp-support)');
  });
});

describe('StatStrip', () => {
  it('is a list, with one item for each figure', () => {
    const html = renderToStaticMarkup(
      <StatStrip label="Our record">
        <Stat value="42" label="Forecasts resolved" />
        <Stat value="0.18" label="Brier score" note="Lower is better" />
        {null}
      </StatStrip>,
    );
    expect(html).toMatch(/^<ul [^>]*role="list"/);
    expect(html).toContain('aria-label="Our record"');
    expect(count(html, '<li')).toBe(2);
    expect(html).toContain('Forecasts resolved');
    expect(html).toContain('Lower is better');
  });
});

describe('NextStops', () => {
  const stops = [
    { module: 'civic', title: 'Services', description: 'Benefits and paperwork.', href: '/civic' },
    { module: 'path', title: 'Your path', href: '/path' },
    { module: 'ask', title: 'Talk it through', href: '/ask' },
    { module: 'mind', title: 'Mind', href: '/mind' },
    { module: 'goals', title: 'Goals', href: '/goals' },
  ] as const;

  it('is a titled list of links, each with its module mark', () => {
    const html = renderToStaticMarkup(
      <NextStops title="Also on Waypoint" stops={stops.slice(0, 2)} />,
    );
    expect(html).toMatch(/<h2[^>]*>Also on Waypoint<\/h2>/);
    // A named region, so it can be found by its title.
    const id = /<h2 id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${id}"`);
    expect(count(html, '<li')).toBe(2);
    expect(html).toMatch(/<a [^>]*href="\/civic"/);
    expect(html).toMatch(/<a [^>]*href="\/path"/);
    expect(html).toContain('Benefits and paperwork.');
    expect(html).toContain('--line:var(--wp-line-civic)');
  });

  it('never shows more than three: it is a list of next stops, not a feed', () => {
    const html = renderToStaticMarkup(<NextStops title="Also on Waypoint" stops={[...stops]} />);
    expect(count(html, '<li')).toBe(3);
    expect(html).not.toContain('href="/mind"');
  });

  it('shows nothing at all when there is nowhere to go', () => {
    expect(renderToStaticMarkup(<NextStops title="Also on Waypoint" stops={[]} />)).toBe('');
  });

  it('lets the app draw the link itself (its own router link)', () => {
    const html = renderToStaticMarkup(
      <NextStops
        title="Also on Waypoint"
        stops={stops.slice(0, 1)}
        renderLink={({ href, className, children }) => (
          <a href={href} className={className} data-router="app">
            {children}
          </a>
        )}
      />,
    );
    expect(html).toMatch(/<a href="\/civic" class="[^"]*row[^"]*" data-router="app"/);
  });
});
