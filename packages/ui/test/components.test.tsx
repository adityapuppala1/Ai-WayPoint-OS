/**
 * What the components put on the page, rendered the way the server renders them (no browser
 * needed). How they move and look in a real browser is checked in apps/web/e2e/design.spec.ts.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageSkeleton, Panel, Probability, RiskMeter, Route, Skeleton } from '../src';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('PageSkeleton', () => {
  it('says that the page is loading and draws a heading, the Sign and two panels', () => {
    const html = renderToStaticMarkup(<PageSkeleton label="Loading your day" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading your day');
    expect(count(html, 'pageSkeletonHead')).toBe(1);
    expect(count(html, 'pageSkeletonSign')).toBe(1);
    expect(count(html, 'pageSkeletonPanel')).toBe(2);
  });

  it('leaves the Sign out for pages without one, and draws as many panels as asked', () => {
    const html = renderToStaticMarkup(<PageSkeleton sign={false} panels={3} />);
    expect(count(html, 'pageSkeletonSign')).toBe(0);
    expect(count(html, 'pageSkeletonPanel')).toBe(3);
  });

  it('keeps the blocks themselves away from screen readers', () => {
    const html = renderToStaticMarkup(<Skeleton onCanvas />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('skeletonOnCanvas');
  });
});

describe('Route', () => {
  const stations = [
    { id: 'a', label: 'Map your skills', state: 'done', href: '/path/skills' },
    { id: 'b', label: 'Learn SQL basics', state: 'current' },
    { id: 'c', label: 'Apply', state: 'upcoming' },
  ] as const;

  it('makes a station label a link when the station has somewhere to go', () => {
    const html = renderToStaticMarkup(<Route label="Plan" stations={[...stations]} />);
    expect(html).toMatch(/<a [^>]*href="\/path\/skills"[^>]*>Map your skills<\/a>/);
    // Stations without an address stay plain text.
    expect(count(html, '<a ')).toBe(1);
    expect(html).toContain('Learn SQL basics');
  });

  it('marks each station with its state, and the current one as the current step', () => {
    const html = renderToStaticMarkup(<Route label="Plan" stations={[...stations]} />);
    expect(count(html, 'data-state="done"')).toBe(1);
    expect(count(html, 'data-state="current"')).toBe(1);
    expect(count(html, 'data-state="upcoming"')).toBe(1);
    expect(count(html, 'aria-current="step"')).toBe(1);
    // The state is said in words too, never by the dot alone.
    expect(html).toContain('You are here: ');
  });
});

describe('Panel', () => {
  it('lifts on hover only when it is marked as a way in', () => {
    expect(renderToStaticMarkup(<Panel title="Plain">x</Panel>)).not.toContain('interactive');
    expect(
      renderToStaticMarkup(
        <Panel title="Card" interactive>
          x
        </Panel>,
      ),
    ).toContain('interactive');
  });
});

describe('meters', () => {
  it('RiskMeter numbers its steps so they can fill one after the other', () => {
    const html = renderToStaticMarkup(
      <RiskMeter
        level="high"
        verdict="Likely a scam"
        scale={['Safe', 'Unclear', 'Likely', 'Very']}
      />,
    );
    expect(count(html, 'data-on="true"')).toBe(3);
    for (const step of [0, 1, 2, 3]) expect(html).toContain(`--step:${step}`);
    expect(html).toContain('Likely a scam');
  });

  it('Probability keeps the number, the words and a meter with the value as text', () => {
    const html = renderToStaticMarkup(
      <Probability value={0.68} words="Likely" label="Chance this happens" valueText="68 %" />,
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="68"');
    expect(html).toContain('aria-valuetext="68 %"');
    expect(html).toContain('inline-size:68%');
    expect(html).toContain('Likely');
  });
});
