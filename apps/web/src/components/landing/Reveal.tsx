'use client';

import { stillnessPreferred } from '@waypoint/ui';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import styles from './landing.module.css';

/**
 * Shows its content arriving once, as it scrolls into view. Used for three moments on the
 * welcome page only (the situations, the route of how it works, the screens), never for
 * what is on screen when the page opens.
 *
 * The content is visible until this runs: the server draws it as it is, and only a browser
 * that will animate it hides it first. Nothing is hidden with less motion asked for, in lite
 * mode, or for anything already in view; and it never replays on the way back up. The
 * motion itself is CSS, so base.css's switches apply to it as to everything else.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds to wait after the element arrives, for a wave across siblings. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || stillnessPreferred() || typeof IntersectionObserver === 'undefined') return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = 'waiting';
    let frame = 0;
    const stop = () => {
      seen.disconnect();
      el.removeEventListener('focusin', show);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
    function show() {
      el?.setAttribute('data-reveal', 'shown');
      stop();
    }
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) show();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    seen.observe(el);
    // A jump past it (End, a link further down) never crosses into view, so the observer
    // never says; once its top is above the fold it shows, so nothing above stays hidden.
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.9) show();
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // A keyboard reaching something still waiting shows it at once.
    el.addEventListener('focusin', show);
    return stop;
  }, []);
  return (
    <div
      ref={ref}
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
