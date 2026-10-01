import { parseNotNow } from '@waypoint/core';
import { describe, expect, it } from 'vitest';
import { notNowCookie, notNowStorageKey, setAside } from '../src/features/not-now';

describe('“Not now” on the phone', () => {
  const evening = new Date('2026-10-01T20:30:00Z');

  it('keeps the steps set aside on the day it is where the person is', () => {
    // 20:30 in London is still the 1st; in Auckland it is already the 2nd.
    const london = setAside(null, 'k1', evening, 'Europe/London');
    expect(parseNotNow(london, '2026-10-01')).toEqual(['k1']);
    const auckland = setAside(null, 'k1', evening, 'Pacific/Auckland');
    expect(parseNotNow(auckland, '2026-10-02')).toEqual(['k1']);

    const both = setAside(london, 'k2', evening, 'Europe/London');
    expect(parseNotNow(both, '2026-10-01')).toEqual(['k1', 'k2']);
    // The next day starts empty.
    const tomorrow = setAside(both, 'k3', new Date('2026-10-02T09:00:00Z'), 'Europe/London');
    expect(parseNotNow(tomorrow, '2026-10-02')).toEqual(['k3']);
  });

  it('sends them in the cookie the server reads from the website', () => {
    expect(notNowCookie('2026-10-01:k1.k2')).toBe('wp-not-now=2026-10-01:k1.k2');
    expect(notNowCookie(null)).toBeUndefined();
  });

  it('keeps each person’s list apart on a shared phone', () => {
    expect(notNowStorageKey('user-a')).not.toBe(notNowStorageKey('user-b'));
  });
});
