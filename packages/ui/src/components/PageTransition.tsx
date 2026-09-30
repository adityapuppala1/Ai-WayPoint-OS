import { type ReactNode, ViewTransition } from 'react';

/**
 * Class names for the parts of the app's frame that stay where they are while a page
 * changes. Put one on the rail, the bottom bar and the phone header (only one element on
 * the page may carry each). The browser then draws them on their own, above the page, and
 * the rules in utilities.css keep them still.
 */
export const viewTransition = {
  rail: 'wp-vt-rail',
  bottomBar: 'wp-vt-bottom-bar',
  header: 'wp-vt-header',
} as const;

/**
 * Moving from one page to the next: the old page fades out and the new one rises into its
 * place, in 240ms together. It wraps what changes between pages, in a place that is made
 * new for every page: a route's `template.tsx` (or the page itself). A layout stays where
 * it is across pages, so there it would do nothing.
 *
 * The browser does the drawing (the View Transitions API, through React's ViewTransition).
 * A browser without it simply shows the next page. Lite mode and a request for less motion
 * are handled in base.css with everything else that moves.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="wp-page-in" exit="wp-page-out" default="none">
      {children}
    </ViewTransition>
  );
}
