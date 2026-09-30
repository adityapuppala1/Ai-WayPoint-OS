import { PageTransition } from '@waypoint/ui';
import type { ReactNode } from 'react';

/**
 * A template is made new for every page under it (a layout is not), so this is where a page
 * transition belongs: the page that leaves fades out and the one that arrives rises in.
 */
export default function DesignTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
