import { describe, expect, it } from 'vitest';
import { CONSOLE_AREAS, CONSOLE_PATHS, canUse, consoleFor, isStaffRole } from '../src/console';

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
