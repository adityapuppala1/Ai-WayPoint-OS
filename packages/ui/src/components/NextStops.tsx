import { type ReactNode, useId } from 'react';
import { List, ListItem } from './List';
import { type ModuleKey, ModuleMark } from './ModuleMark';
import { Panel } from './Panel';
import { RouteLink } from './RouteLink';

export interface NextStop {
  /** Where the row leads: its mark is drawn in that module's line colour. */
  module: ModuleKey;
  title: ReactNode;
  description?: ReactNode;
  href: string;
}

export interface NextStopsProps {
  /** The heading, translated by the app: "Also on Waypoint". */
  title: ReactNode;
  /** Where to go from here. Only the first three are shown. */
  stops: readonly NextStop[];
  /**
   * Draws the link with the app's own router link (for prefetching). Without it the row
   * still goes through the app's router, as every link in the design system does.
   */
  renderLink?: (props: { href: string; className: string; children: ReactNode }) => ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}

/** A page has room for three places to go next; a longer list would be a feed. */
const MOST = 3;

/**
 * "Also on Waypoint": the places that follow from this page, at its foot. A short list of
 * rows, each with the mark of the module it leads to. At most three, chosen by the page for
 * the person's situation; never a feed and never a carousel. Shows nothing when there is
 * nowhere to go.
 */
export function NextStops({
  title,
  stops,
  renderLink,
  headingLevel = 2,
  className,
}: NextStopsProps) {
  const id = useId();
  const shown = stops.slice(0, MOST);
  if (shown.length === 0) return null;
  return (
    <Panel id={id} title={title} headingLevel={headingLevel} flush className={className}>
      <List>
        {shown.map((stop) => (
          <ListItem
            key={stop.href}
            leading={<ModuleMark module={stop.module} size="sm" />}
            title={stop.title}
            description={stop.description}
            render={({ className: row, children }) =>
              renderLink ? (
                renderLink({ href: stop.href, className: row, children })
              ) : (
                <RouteLink href={stop.href} className={row}>
                  {children}
                </RouteLink>
              )
            }
          />
        ))}
      </List>
    </Panel>
  );
}
