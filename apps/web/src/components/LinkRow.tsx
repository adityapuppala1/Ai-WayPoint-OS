import { ListItem, type ListItemProps } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { LinkPending } from '@/components/shell/pending';

/** A list row that navigates with the Next.js router (prefetching, no full reload). */
export function LinkRow({
  href,
  external,
  ...props
}: Omit<ListItemProps, 'href' | 'render'> & { href: string; external?: boolean }) {
  if (external) {
    return (
      <ListItem
        {...props}
        render={({ className, children }) => (
          <a href={href} className={className} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        )}
      />
    );
  }
  return (
    <ListItem
      {...props}
      render={({ className, children }) => (
        <Link href={href as Route} className={className}>
          {children}
          {/* Tells the page frame this row is waiting for its page, so it can hold the place. */}
          <LinkPending />
        </Link>
      )}
    />
  );
}
