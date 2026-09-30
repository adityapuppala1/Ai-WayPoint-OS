import { PageTransition } from '@waypoint/ui';
import type { ReactNode } from 'react';

/** Moving between this module's own pages: the same page transition as between modules. */
export default function ModuleTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
