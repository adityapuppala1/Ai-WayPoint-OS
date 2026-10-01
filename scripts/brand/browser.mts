/**
 * Chromium from the web app's Playwright, for drawing SVG into PNG and WebP files. Nothing is
 * downloaded: it is the browser the browser tests already use
 * (`pnpm --filter @waypoint/web exec playwright install chromium` once).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Browser } from '@playwright/test';

export const ROOT = join(import.meta.dirname, '..', '..');
const fromWeb = createRequire(join(ROOT, 'apps', 'web', 'package.json'));

export async function launch(): Promise<Browser> {
  const { chromium } = fromWeb('@playwright/test') as typeof import('@playwright/test');
  return chromium.launch();
}

/** sharp, which Next.js installs for its image optimiser; used here to write WebP and RGB PNG. */
export function sharp(): typeof import('sharp') {
  const fromNext = createRequire(fromWeb.resolve('next/package.json'));
  return fromNext('sharp') as typeof import('sharp');
}

/**
 * Draws `svg` at `size` × `size` pixels. `background` fills the canvas first (an icon that
 * must have no transparency); without it the picture keeps its transparent parts.
 */
export async function rasterise(
  browser: Browser,
  svg: string,
  size: number,
  background?: string,
): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  try {
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${background ?? 'transparent'}}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`,
    );
    return await page.screenshot({ omitBackground: !background, type: 'png' });
  } finally {
    await page.close();
  }
}
