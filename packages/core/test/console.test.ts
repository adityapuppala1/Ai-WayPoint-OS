import { describe, expect, it } from 'vitest';
import {
  announcementActive,
  apiOpenDuringMaintenance,
  CONSOLE_AREAS,
  CONSOLE_PATHS,
  canUse,
  consoleFor,
  isStaffRole,
  maintenanceActive,
  pageOpenDuringMaintenance,
} from '../src/console';

describe('who may open which part of the console', () => {
  it('lets an admin open everything', () => {
    for (const area of CONSOLE_AREAS) expect(canUse('admin', area), area).toBe(true);
  });

  it('lets staff look after content, safety, feedback and the numbers, and nothing else', () => {
    const open = CONSOLE_AREAS.filter((a) => canUse('staff', a));
    expect(open).toEqual([
      'overview',
      'moderation',
      'reports',
      'forecasts',
      'signals',
      'feedback',
      'analytics',
    ]);
    for (const area of [
      'users',
      'staff',
      'integrations',
      'system',
      'maintenance',
      'audit',
    ] as const)
      expect(canUse('staff', area), area).toBe(false);
  });

  it('opens nothing to anyone else', () => {
    for (const role of ['member', 'user', '', null, undefined, 'Admin', 'admin '])
      for (const area of CONSOLE_AREAS) expect(canUse(role, area)).toBe(false);
    expect(isStaffRole('member')).toBe(false);
    expect(isStaffRole('staff')).toBe(true);
  });

  it('lists each role only the groups it can use, each with a page', () => {
    expect(consoleFor('staff').map((g) => g.group)).toEqual([
      'home',
      'safety',
      'content',
      'insights',
    ]);
    expect(consoleFor('member')).toEqual([]);
    for (const area of CONSOLE_AREAS) expect(CONSOLE_PATHS[area]).toMatch(/^\/admin(\/[a-z]+)?$/);
  });
});

describe('maintenance', () => {
  const now = new Date('2026-10-01T20:00:00Z');
  const on = { on: true, message: 'Upgrading.', until: null, startsAt: null };

  it('is in force between its start and its end', () => {
    expect(maintenanceActive(on, now)).toBe(true);
    expect(maintenanceActive({ ...on, on: false }, now)).toBe(false);
    expect(maintenanceActive({ ...on, startsAt: '2026-10-01T21:00:00Z' }, now)).toBe(false);
    expect(maintenanceActive({ ...on, until: '2026-10-01T19:59:00Z' }, now)).toBe(false);
    expect(
      maintenanceActive(
        { ...on, startsAt: '2026-10-01T19:00:00Z', until: '2026-10-01T22:00:00Z' },
        now,
      ),
    ).toBe(true);
  });

  it('never closes help, texts, signing in or the legal pages', () => {
    for (const path of [
      '/support',
      '/support/check',
      '/sign-in',
      '/privacy',
      '/terms',
      '/admin/users',
    ])
      expect(pageOpenDuringMaintenance(path), path).toBe(true);
    for (const path of ['/', '/welcome', '/ask', '/sign-up', '/supporting', '/privacy/old'])
      expect(pageOpenDuringMaintenance(path), path).toBe(false);
    for (const path of [
      '/api/health',
      '/api/support',
      '/api/channels/twilio/sms',
      '/api/auth/sign-in/email',
      '/api/auth/get-session',
      '/api/auth/sign-out',
      '/api/platform',
    ])
      expect(apiOpenDuringMaintenance(path), path).toBe(true);
    for (const path of [
      '/api/today',
      '/api/auth/sign-up/email',
      '/api/auth/sign-in/anonymous',
      '/api/ask',
    ])
      expect(apiOpenDuringMaintenance(path), path).toBe(false);
  });

  it('shows an announcement until its end, and only with words', () => {
    const a = { on: true, message: 'Tonight from 22:00.', tone: 'info' as const, until: null };
    expect(announcementActive(a, now)).toBe(true);
    expect(announcementActive({ ...a, message: '  ' }, now)).toBe(false);
    expect(announcementActive({ ...a, until: '2026-10-01T19:00:00Z' }, now)).toBe(false);
  });
});
