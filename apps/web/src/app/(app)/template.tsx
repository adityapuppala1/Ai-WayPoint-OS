import { PageTransition } from '@waypoint/ui';
import type { ReactNode } from 'react';

/**
 * A template is made new for every page under it (the layout, with the rail and the bottom
 * bar, is not), so this is where moving between pages happens: the page that leaves fades
 * out and the next one rises in, while the frame stays still. Modules with pages of their own
 * (Path, Signals, Settings…) repeat this in their folder, for moves inside the module.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
