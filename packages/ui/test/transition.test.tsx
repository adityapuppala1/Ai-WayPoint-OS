/**
 * Moving between pages. The transition itself is drawn by the browser and is checked in
 * apps/web/e2e/design.spec.ts; its stylesheet rules are checked in styles.test.ts.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageTransition, viewTransition } from '../src';

describe('PageTransition', () => {
  it('draws its page as it is: the transition is something the browser adds', () => {
    const html = renderToStaticMarkup(
      <PageTransition>
        <p>Money</p>
      </PageTransition>,
    );
    expect(html).toContain('<p');
    expect(html).toContain('Money');
  });

  it('names the parts of the frame that stay where they are', () => {
    expect(viewTransition.rail).toBe('wp-vt-rail');
    expect(viewTransition.bottomBar).toBe('wp-vt-bottom-bar');
    expect(viewTransition.header).toBe('wp-vt-header');
  });
});
