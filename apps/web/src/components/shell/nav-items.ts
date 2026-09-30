/**
 * The modules in navigation order. Plain data (no 'use client'), so server pages such as
 * All modules can read it too: values exported from a client module reach server components
 * only as references, not as the array itself.
 */
import type { ModuleKey } from '@waypoint/ui';
import type { Route } from 'next';

export interface NavItem {
  key: ModuleKey;
  href: Route;
  /** `false` modules link to the All modules page until they're built. */
  ready: boolean;
}

export const NAV: NavItem[] = [
  { key: 'today', href: '/', ready: true },
  { key: 'path', href: '/path', ready: true },
  { key: 'shield', href: '/shield', ready: true },
  { key: 'ask', href: '/ask', ready: true },
  { key: 'signals', href: '/signals', ready: true },
  { key: 'circles', href: '/circles' as Route, ready: true },
  { key: 'money', href: '/money' as Route, ready: true },
  { key: 'mind', href: '/mind' as Route, ready: true },
  { key: 'health', href: '/health' as Route, ready: true },
  { key: 'civic', href: '/civic' as Route, ready: true },
  { key: 'surroundings', href: '/surroundings' as Route, ready: true },
  { key: 'goals', href: '/goals' as Route, ready: true },
];
