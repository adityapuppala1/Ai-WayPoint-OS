'use client';

import { Skeleton } from '@waypoint/ui';
import { useLinkStatus } from 'next/link';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import styles from './shell.module.css';

/*
 * "The app never looks frozen". Every page here is made on the server for the person asking,
 * so on a slow connection a pressed link used to show nothing until the answer arrived.
 *
 * A route-level loading file would fix that, but it starts the answer before the page has
 * decided whether the person may see it: a refused page (the staff console for anyone else, a
 * plan that is not theirs) would then answer "200, here is a placeholder" instead of 404, and
 * a signed-out visitor would get a page instead of a redirect. So the placeholder lives here
 * instead: a link says when it is waiting for its page, and the frame around the page shows a
 * page-shaped placeholder until it arrives. First visits and refusals answer as before.
 */

// How many pressed links are waiting for their page (none, or one).
let waiting = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function change(by: number) {
  waiting += by;
  for (const listener of listeners) listener();
}

/**
 * Goes inside a link. Tells the page frame while that link waits for its page and, given a
 * class, draws the "you are here" marker on it the moment it is pressed.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    change(1);
    return () => change(-1);
  }, [pending]);
  // Always there, so nothing in the link moves when it appears.
  return className ? (
    <span className={className} data-pending={pending || undefined} aria-hidden="true" />
  ) : null;
}

/** Long enough that a page which answers quickly never flashes a placeholder. */
const PATIENCE_MS = 150;

/**
 * The frame around a page. While a pressed link waits for its page, the page that was here
 * gives way to a placeholder in the shape of the next one.
 */
export function PageFrame({ children, label }: { children: ReactNode; label: string }) {
  const pending = useSyncExternalStore(
    subscribe,
    () => waiting > 0,
    () => false,
  );
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  return (
    <>
      {slow ? <PagePlaceholder label={label} /> : null}
      <div className={styles.page} hidden={slow}>
        {children}
      </div>
    </>
  );
}

/**
 * A page head and two panels, as grey bars. Lite mode and reduced motion keep the bars still
 * (the design system turns all animation off for both).
 */
function PagePlaceholder({ label }: { label: string }) {
  return (
    <div className={`wp-page ${styles.placeholder}`} role="status">
      <span className="wp-visually-hidden">{label}</span>
      <div className="wp-page-head">
        <Skeleton width="9rem" height="0.875rem" />
        <Skeleton width="min(22rem, 80%)" height="2.5rem" />
      </div>
      {[0, 1].map((panel) => (
        <div key={panel} className={styles.placeholderPanel}>
          <Skeleton width="40%" height="1.25rem" />
          <Skeleton />
          <Skeleton width="85%" />
          <Skeleton width="60%" />
        </div>
      ))}
    </div>
  );
}
