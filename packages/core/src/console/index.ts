/**
 * The platform console: who on the staff may open which part of it.
 *
 * Two roles. An admin runs the platform: people and their accounts, staff and invitations,
 * outside services and their keys, the system and maintenance, and the activity log. Staff
 * look after what people see and send: moderation, scam reports, forecasts, signals and
 * feedback, with the overview and the analytics to guide them. Nobody on the staff ever
 * sees what a person wrote for themselves (journal, notes, mood, money, conversations).
 */

export const STAFF_ROLES = ['admin', 'staff'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Every part of the console, in the order it is listed, by group. */
export const CONSOLE_GROUPS = [
  { group: 'home', areas: ['overview'] },
  { group: 'people', areas: ['users', 'staff'] },
  { group: 'safety', areas: ['moderation', 'reports'] },
  { group: 'content', areas: ['forecasts', 'signals', 'feedback'] },
  { group: 'insights', areas: ['analytics'] },
  { group: 'platform', areas: ['integrations', 'system', 'maintenance', 'audit'] },
] as const;

export type ConsoleGroup = (typeof CONSOLE_GROUPS)[number]['group'];
export type ConsoleArea = (typeof CONSOLE_GROUPS)[number]['areas'][number];

export const CONSOLE_AREAS: readonly ConsoleArea[] = CONSOLE_GROUPS.flatMap((g) => g.areas);

/** Where each part of the console lives. */
export const CONSOLE_PATHS: Record<ConsoleArea, string> = {
  overview: '/admin',
  users: '/admin/users',
  staff: '/admin/staff',
  moderation: '/admin/moderation',
  reports: '/admin/reports',
  forecasts: '/admin/forecasts',
  signals: '/admin/signals',
  feedback: '/admin/feedback',
  analytics: '/admin/analytics',
  integrations: '/admin/integrations',
  system: '/admin/system',
  maintenance: '/admin/maintenance',
  audit: '/admin/audit',
};

/** What staff (not admins) may open. Admins may open everything. */
const STAFF_AREAS: ReadonlySet<ConsoleArea> = new Set<ConsoleArea>([
  'overview',
  'moderation',
  'reports',
  'forecasts',
  'signals',
  'feedback',
  'analytics',
]);

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role ?? '');
}

/** Whether someone with this role may open this part of the console. */
export function canUse(role: string | null | undefined, area: ConsoleArea): boolean {
  if (role === 'admin') return true;
  return role === 'staff' && STAFF_AREAS.has(area);
}

/** The parts of the console this role may open, grouped as they are listed. */
export function consoleFor(
  role: string | null | undefined,
): Array<{ group: ConsoleGroup; areas: ConsoleArea[] }> {
  return CONSOLE_GROUPS.map((g) => ({
    group: g.group,
    areas: g.areas.filter((a) => canUse(role, a)) as ConsoleArea[],
  })).filter((g) => g.areas.length > 0);
}

export * from './integrations';
