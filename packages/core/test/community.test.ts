import { describe, expect, it } from 'vitest';
import { memberNumber, moderatePost } from '../src/community';

describe('circles moderation', () => {
  it('publishes ordinary posts untouched', () => {
    const m = moderatePost('Had my second interview today. Nervous but it went okay!');
    expect(m.hold).toBeNull();
    expect(m.text).toBe('Had my second interview today. Nervous but it went okay!');
    expect(m.masked).toEqual([]);
  });

  it('holds posts that suggest someone is in danger', () => {
    const m = moderatePost('I don’t see the point anymore, I am going to end my life tonight');
    expect(m.hold).toBe('crisis');
    expect(m.crisis.tier).toBeGreaterThanOrEqual(2);
  });

  it('does not hold ordinary sadness', () => {
    expect(
      moderatePost('Feeling low after another rejection, but trying again tomorrow').hold,
    ).toBeNull();
  });

  it('holds likely scams aimed at the group', () => {
    const m = moderatePost(
      'Work from home job! Earn ₹5000 per day. Pay registration fee of ₹999 on WhatsApp to join.',
      { country: 'IN' },
    );
    expect(m.hold).toBe('scam');
  });

  it('masks phone numbers and emails so nobody is contacted off-platform', () => {
    const m = moderatePost('Call me on +91 98765 43210 or write to ravi.k@example.com');
    expect(m.text).not.toContain('98765');
    expect(m.text).not.toContain('ravi.k@example.com');
    expect(m.masked).toEqual(expect.arrayContaining(['phone', 'email']));
  });

  it('gives each person a different number in each circle', () => {
    const a = memberNumber('user-1', 'circle-a');
    expect(a).toBe(memberNumber('user-1', 'circle-a'));
    expect(a).not.toBe(memberNumber('user-1', 'circle-b'));
    expect(a).toBeGreaterThanOrEqual(1000);
    expect(a).toBeLessThan(10000);
  });
});
