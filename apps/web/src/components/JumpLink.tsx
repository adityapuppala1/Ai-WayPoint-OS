'use client';

import type { MouseEvent, ReactNode } from 'react';

const FIELDS =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';
const CONTROLS = 'button:not([disabled]), a[href]';

const shown = (el: HTMLElement) => el.getClientRects().length > 0;

/** The first field in a part of the page or, where it has none, its first button or link. */
export function firstControl(part: HTMLElement): HTMLElement | undefined {
  return (
    [...part.querySelectorAll<HTMLElement>(FIELDS)].find(shown) ??
    [...part.querySelectorAll<HTMLElement>(CONTROLS)].find(shown)
  );
}

/**
 * A link to another part of the same page that also puts the keyboard there, ready to type:
 * "Add a goal" lands in the goal's first field, not just near it. Without scripts, or when
 * that part has nothing to type into or press, it is an ordinary link to the part.
 */
export function JumpLink({
  to,
  children,
  className,
}: {
  /** The id of the part of the page to go to. */
  to: string;
  children: ReactNode;
  className?: string;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const part = document.getElementById(to);
    const target = part ? firstControl(part) : undefined;
    // The link itself does the scrolling (it stops clear of the phone's header); once it has,
    // the keyboard goes to the field without moving the page again.
    if (target) requestAnimationFrame(() => target.focus({ preventScroll: true }));
  };
  return (
    <a href={`#${to}`} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
