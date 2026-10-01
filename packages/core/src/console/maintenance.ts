/**
 * Maintenance and announcements: what an admin can switch on for everyone, and what stays
 * open whatever happens. Help in a crisis is never closed for maintenance: Get help now, the
 * help numbers, and texts sent to Waypoint's numbers keep working, as do signing in and out (so
 * staff can reach the console; new accounts and guests wait), the privacy notice and terms, and
 * the platform's health checks.
 */

export interface MaintenanceState {
  on: boolean;
  /** What people see, in the admin's own words (one language; shown as written). */
  message: string;
  /** When it is expected to end (shown to people), and when it starts, if scheduled. */
  until: string | null;
  startsAt: string | null;
}

export interface AnnouncementState {
  on: boolean;
  message: string;
  tone: 'info' | 'caution';
  until: string | null;
}

export interface BackupNote {
  /** When the last backup someone confirmed was made, where it is kept, and who noted it. */
  at: string;
  note: string;
}

export const MAINTENANCE_OFF: MaintenanceState = {
  on: false,
  message: '',
  until: null,
  startsAt: null,
};
export const ANNOUNCEMENT_OFF: AnnouncementState = {
  on: false,
  message: '',
  tone: 'info',
  until: null,
};

/** Whether maintenance is in force now (switched on, its start reached, its end not passed). */
export function maintenanceActive(m: MaintenanceState, now = new Date()): boolean {
  if (!m.on) return false;
  if (m.startsAt && new Date(m.startsAt).getTime() > now.getTime()) return false;
  if (m.until && new Date(m.until).getTime() <= now.getTime()) return false;
  return true;
}

export function announcementActive(a: AnnouncementState, now = new Date()): boolean {
  return (
    a.on && a.message.trim().length > 0 && (!a.until || new Date(a.until).getTime() > now.getTime())
  );
}

/** Website pages that stay open during maintenance. */
const OPEN_PAGES = [
  /^\/support(\/|$)/,
  /^\/sign-in(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/privacy$/,
  /^\/terms$/,
];

/** API routes that stay open during maintenance (paths start with /api). */
const OPEN_API = [
  /^\/api\/(health|ready)$/,
  // Signing in and out, but not creating accounts or guests (they would write as people do).
  /^\/api\/auth\/(?!sign-up|sign-in\/anonymous)/,
  /^\/api\/support(\/|$)/,
  /^\/api\/channels\//,
  /^\/api\/admin(\/|$)/,
  /^\/api\/platform$/,
  // Counting a page opened writes nothing people wrote, and keeps the maintenance screen quiet.
  /^\/api\/activity$/,
];

export function pageOpenDuringMaintenance(path: string): boolean {
  return OPEN_PAGES.some((re) => re.test(path));
}

export function apiOpenDuringMaintenance(path: string): boolean {
  return OPEN_API.some((re) => re.test(path));
}
