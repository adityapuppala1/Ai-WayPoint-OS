import { viewTransition } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './design.module.css';

/**
 * The frame around the design system's two pages: a bar that stays where it is while the
 * page under it changes. It carries the name the app's own phone header carries, so the
 * page transition leaves it still (see template.tsx).
 */
export default function DesignLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Design system pages" className={`${styles.bar} ${viewTransition.header}`}>
        <Link href="/design">Design system</Link>
        <Link href={'/design/module' as Route}>An example page</Link>
      </nav>
      {children}
    </>
  );
}
