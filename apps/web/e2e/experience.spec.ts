/**
 * The pages people meet first — welcome, getting started, Today, Ask, Shield, What's next?,
 * settings and All modules — at a small phone (375 px) and a laptop (1280 px), in light and
 * dark, in English and in Arabic (right to left). Each must fit the screen without sideways
 * scrolling, keep every control big enough to press, show where the keyboard focus is, and
 * mirror for right-to-left reading. Screenshots are saved with the results for looking over.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, startAsGuest, test } from './fixtures';

const PAGES = [
  { name: 'welcome', path: '/welcome', guest: false },
  { name: 'start', path: '/start', guest: false },
  { name: 'today', path: '/', guest: true },
  { name: 'ask', path: '/ask', guest: true },
  { name: 'shield', path: '/shield', guest: true },
  { name: 'forecasts', path: '/signals/forecasts', guest: true },
  { name: 'settings', path: '/settings', guest: true },
  { name: 'explore', path: '/explore', guest: true },
] as const;

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'laptop', width: 1280, height: 800 },
] as const;

/** Set AUDIT_DIR to keep every screenshot in one folder (for a review by eye). */
const AUDIT_DIR = process.env.AUDIT_DIR;

/** What a person could not use or read, measured in the page itself. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width <= 0 || r.height <= 0 || s.visibility === 'hidden' || s.display === 'none')
        return false;
      if (el.closest('.wp-visually-hidden, [hidden], [aria-hidden="true"]')) return false;
      // An input kept for screen readers behind a larger control (a slider's thumb, a switch)
      // is clipped away, itself or by its wrapper: it is not what a person presses.
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.opacity === '0' || ps.clip !== 'auto' || ps.clipPath !== 'none') return false;
      }
      return true;
    };
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(
        el.getAttribute('aria-label') ??
        el.textContent ??
        ''
      )
        .trim()
        .slice(0, 40)}"`;
    const doc = document.documentElement;
    // Anything wider than the screen, or starting off its edge.
    const spill = [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (!visible(el)) return false;
        // Content inside a box that scrolls sideways on purpose (a wide table) is fine.
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false;
        }
        const r = el.getBoundingClientRect();
        return r.right > doc.clientWidth + 1 || r.left < -1;
      })
      .map(name)
      .slice(0, 5);
    // WCAG 2.2 (2.5.8): controls at least 24 × 24 px. Links inside a sentence are exempt.
    const controls = [
      ...document.querySelectorAll(
        'button, [role="button"], [role="tab"], [role="switch"], select, textarea, summary, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
      ),
    ].filter(visible);
    const small = controls
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      })
      .map(name);
    // The design system's own bar for anything pressed with a thumb: 44 px in one direction.
    const cramped = [...controls, ...document.querySelectorAll('nav a, a[class*="button" i]')]
      .filter(visible)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return Math.max(r.height, r.width) < 44 || Math.min(r.height, r.width) < 32;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`;
      });
    return {
      sideways: doc.scrollWidth > doc.clientWidth + 1,
      spill,
      small,
      cramped,
      dir: doc.getAttribute('dir'),
      theme: doc.getAttribute('data-theme'),
    };
  });
}

/** Tab through the first few stops: each must show a focus ring. */
async function focusProblems(page: Page, stops = 6) {
  const missing: string[] = [];
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab');
    const found = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring =
        (s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) >= 2) ||
        s.boxShadow !== 'none';
      return ring
        ? null
        : `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
    });
    if (found) missing.push(found);
  }
  return missing;
}

for (const size of SIZES) {
  for (const theme of ['light', 'dark'] as const) {
    for (const locale of ['en', 'ar'] as const) {
      test(`the first pages fit a ${size.name} in ${theme}, ${locale === 'ar' ? 'Arabic' : 'English'} @desktop`, async ({
        page,
        context,
        baseURL,
      }, testInfo) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: size.width, height: size.height });
        const cookies = (l: string) => [
          { name: 'NEXT_LOCALE', value: l, url: baseURL ?? '' },
          { name: 'wp-theme', value: theme, url: baseURL ?? '' },
        ];
        const found: string[] = [];
        const check = async (name: string) => {
          // Not "network idle": Today keeps fetching the weather. Wait for the page and its fonts.
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const m = await measure(page);
          const at = `${name} (${size.name}, ${theme}, ${locale})`;
          if (m.sideways) found.push(`${at}: scrolls sideways — ${m.spill.join('; ')}`);
          else if (m.spill.length) found.push(`${at}: off the edge — ${m.spill.join('; ')}`);
          if (m.small.length) found.push(`${at}: too small to press — ${m.small.join('; ')}`);
          if (m.dir !== (locale === 'ar' ? 'rtl' : 'ltr')) found.push(`${at}: dir is ${m.dir}`);
          if (m.theme !== theme) found.push(`${at}: theme is ${m.theme}`);
          if (process.env.AUDIT_CRAMPED && m.cramped.length)
            console.log(`${at}: under 44 px — ${m.cramped.join('; ')}`);
          const file = `${name}-${size.name}-${theme}-${locale}.png`;
          if (AUDIT_DIR) {
            mkdirSync(AUDIT_DIR, { recursive: true });
            await page.screenshot({ path: join(AUDIT_DIR, file), fullPage: true });
          } else await page.screenshot({ path: testInfo.outputPath(file), fullPage: true });
        };

        await context.addCookies(cookies(locale));
        for (const p of PAGES.filter((p) => !p.guest)) {
          await page.goto(p.path);
          await check(p.name);
          const unfocused = await focusProblems(page);
          if (unfocused.length) found.push(`${p.name}: no focus ring on ${unfocused.join('; ')}`);
        }
        // Getting started is walked through in English (the helper reads the English labels).
        await context.addCookies(cookies('en'));
        await startAsGuest(page);
        await context.addCookies(cookies(locale));
        for (const p of PAGES.filter((p) => p.guest)) {
          await page.goto(p.path);
          await check(p.name);
          const unfocused = await focusProblems(page);
          if (unfocused.length) found.push(`${p.name}: no focus ring on ${unfocused.join('; ')}`);
        }
        expect(found).toEqual([]);
      });
    }
  }
}
