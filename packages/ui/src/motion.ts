/**
 * For the little motion that has to be driven from a script (a number counting to its
 * value). Everything else moves in CSS, which base.css switches off in one place; a script
 * has to ask for itself.
 */

/**
 * True when nothing should move: lite mode is on, the device asks for less motion, or there
 * is no page at all (on the server).
 */
export function stillnessPreferred(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true;
  if (document.documentElement.getAttribute('data-lite') === 'true') return true;
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The number to show part-way through a count: `progress` runs from 0 (the old number) to
 * 1 (exactly the new one), slowing as it arrives.
 */
export function countAt(from: number, to: number, progress: number): number {
  if (progress >= 1) return to;
  if (progress <= 0) return from;
  const eased = 1 - (1 - progress) ** 3;
  return from + (to - from) * eased;
}

/**
 * A duration token in milliseconds, read from the stylesheet so the value has one source
 * (e.g. `--wp-duration-route`). `fallback` is used where the token cannot be read.
 */
export function durationToken(name: string, fallback: number): number {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith('ms') ? value : value * 1000;
}
