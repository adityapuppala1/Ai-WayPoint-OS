'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../cn';
import { countAt, durationToken, stillnessPreferred } from '../motion';

export interface AnimatedNumberProps {
  value: number;
  /**
   * Writes a number the way the reader's language writes it (digits, separators, a unit).
   * It is called for every step of the count, so it must round as well: pass the app's
   * number formatter. A function, because a CSS counter can only write Western digits.
   */
  format: (value: number) => string;
  /**
   * Where to count from when the number first appears on the page. Without it a number
   * that is already there when the page arrives stands still, and counts only when `value`
   * changes.
   */
  from?: number;
  /** Milliseconds. By default as long as the route takes to fill (`--wp-duration-route`). */
  duration?: number;
  className?: string;
}

/**
 * A number that counts to its value when the value changes (a total after something was
 * added, a forecast after an update). The server, and a page without scripts, show the
 * number itself; lite mode and a request for less motion change it at once.
 *
 * This is the one place the design system moves something from a script, because only a
 * formatter function can write Arabic or Hindi digits. It asks for itself whether motion is
 * welcome. While it counts, screen readers are given the number it will arrive at.
 */
export function AnimatedNumber({ value, format, from, duration, className }: AnimatedNumberProps) {
  // The number on screen while counting; null while it stands still at `value`.
  const [counting, setCounting] = useState<number | null>(null);
  const onScreen = useRef(value);
  const appeared = useRef(false);

  useLayoutEffect(() => {
    const start = appeared.current ? onScreen.current : from;
    appeared.current = true;
    const length = duration ?? durationToken('--wp-duration-route', 480);
    const still =
      start === undefined ||
      start === value ||
      !Number.isFinite(start) ||
      !Number.isFinite(value) ||
      !(length > 0) ||
      stillnessPreferred();
    if (still) {
      onScreen.current = value;
      setCounting(null);
      return;
    }
    onScreen.current = start;
    setCounting(start);
    let frame = 0;
    let began: number | null = null;
    const step = (now: number) => {
      began ??= now;
      const progress = (now - began) / length;
      if (progress >= 1) {
        onScreen.current = value;
        setCounting(null);
        return;
      }
      const next = countAt(start, value, progress);
      onScreen.current = next;
      setCounting(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, from, duration]);

  if (counting === null) return <span className={cn('wp-num', className)}>{format(value)}</span>;
  return (
    <span className={cn('wp-num', className)} data-counting="true">
      <span aria-hidden="true">{format(counting)}</span>
      <span className="wp-visually-hidden">{format(value)}</span>
    </span>
  );
}
