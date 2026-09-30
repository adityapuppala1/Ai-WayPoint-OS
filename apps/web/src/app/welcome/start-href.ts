/**
 * Where getting started begins, carrying the page the person was heading for so they arrive
 * there afterwards. Plain module (no 'use client'): the welcome page and its sign both use it.
 */
export function startHref(next: string): string {
  return next === '/' ? '/start' : `/start?next=${encodeURIComponent(next)}`;
}
