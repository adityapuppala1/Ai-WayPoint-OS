'use client';

import { PageSkeleton } from '@waypoint/ui';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
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

// How many pressed links are waiting for their page (none, or one), and how many of those
// lead to a page with a Sign (Today), so the placeholder can have the same shape.
let waiting = 0;
let waitingForSign = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function change(by: number, sign: boolean) {
  waiting += by;
  if (sign) waitingForSign += by;
  for (const listener of listeners) listener();
}

type Waiting = 'none' | 'page' | 'sign';
const snapshot = (): Waiting => (waiting === 0 ? 'none' : waitingForSign > 0 ? 'sign' : 'page');

/**
 * Goes inside a link. Tells the page frame while that link waits for its page and, given a
 * class, draws the "you are here" marker on it the moment it is pressed. `sign`: the page it
 * leads to opens with the Sign (Today), so the placeholder shows one too.
 */
export function LinkPending({ className, sign = false }: { className?: string; sign?: boolean }) {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    change(1, sign);
    return () => change(-1, sign);
  }, [pending, sign]);
  // Always there, so nothing in the link moves when it appears.
  return className ? (
    <span className={className} data-pending={pending || undefined} aria-hidden="true" />
  ) : null;
}

/** Long enough that a page which answers quickly never flashes a placeholder. */
const PATIENCE_MS = 150;

/**
 * The frame around a page. While a pressed link waits for its page, the page that was here
 * gives way to the design system's page-shaped placeholder: a heading, the Sign where the
 * next page has one, and two panels. Lite mode and reduced motion keep its blocks still.
 */
export function PageFrame({ children, label }: { children: ReactNode; label: string }) {
  const pending = useSyncExternalStore(subscribe, snapshot, () => 'none' as const);
  const pathname = usePathname();
  // Where the person was when the wait began. The placeholder stands in only while they are
  // still there: the render that brings the next page (a new address) shows it at once, so
  // the page transition sees it arrive, rather than a page hidden behind the placeholder.
  const [waitingAt, setWaitingAt] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the address when the wait began, not the one it leads to
  useEffect(() => {
    if (pending === 'none') {
      setWaitingAt(null);
      return;
    }
    const timer = setTimeout(() => setWaitingAt(pathname), PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  const slow = waitingAt !== null && waitingAt === pathname;
  return (
    <>
      {slow ? (
        <PageSkeleton label={label} sign={pending === 'sign'} className={styles.placeholder} />
      ) : null}
      <div className={styles.page} hidden={slow}>
        {children}
      </div>
    </>
  );
}
