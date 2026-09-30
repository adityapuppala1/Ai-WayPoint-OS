'use client';

import type { ReactNode } from 'react';
import { Link } from 'react-aria-components';

/**
 * A station's label as a link. Its own client component, so the Route itself can still be
 * rendered on the server while the press goes through the app's router (no full page load).
 */
export function RouteLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
