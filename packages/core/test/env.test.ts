import { afterEach, describe, expect, it } from 'vitest';
import { configWarnings, getEnv, resetEnvForTests } from '../src/env';

const KEYS = [
  'WAYPOINT_OPERATOR',
  'WAYPOINT_CONTACT_EMAIL',
  'WAYPOINT_DATA_LOCATION',
  'WAYPOINT_BACKUP_DAYS',
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
  resetEnvForTests();
  return getEnv();
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetEnvForTests();
});

describe('who runs this Waypoint (privacy notice and terms)', () => {
  it('reads the operator, contact, data location and backup days', () => {
    const env = withEnv({
      WAYPOINT_OPERATOR: ' Example Trust, 1 Road, Nairobi ',
      WAYPOINT_CONTACT_EMAIL: 'privacy@example.org',
      WAYPOINT_DATA_LOCATION: 'Frankfurt, Germany',
      WAYPOINT_BACKUP_DAYS: '14',
    });
    expect(env.WAYPOINT_OPERATOR).toBe('Example Trust, 1 Road, Nairobi');
    expect(env.WAYPOINT_CONTACT_EMAIL).toBe('privacy@example.org');
    expect(env.WAYPOINT_DATA_LOCATION).toBe('Frankfurt, Germany');
    expect(env.WAYPOINT_BACKUP_DAYS).toBe(14);
  });

  it('treats empty values as not set, as in .env.example', () => {
    const env = withEnv({
      WAYPOINT_OPERATOR: '',
      WAYPOINT_CONTACT_EMAIL: '  ',
      WAYPOINT_DATA_LOCATION: '',
      WAYPOINT_BACKUP_DAYS: '',
    });
    expect(env.WAYPOINT_OPERATOR).toBeUndefined();
    expect(env.WAYPOINT_CONTACT_EMAIL).toBeUndefined();
    expect(env.WAYPOINT_DATA_LOCATION).toBeUndefined();
    expect(env.WAYPOINT_BACKUP_DAYS).toBeUndefined();
  });

  it('refuses a contact that is not an email address, or impossible backup days', () => {
    expect(() => withEnv({ WAYPOINT_CONTACT_EMAIL: 'write to us' })).toThrow(
      /WAYPOINT_CONTACT_EMAIL/,
    );
    expect(() => withEnv({ WAYPOINT_BACKUP_DAYS: '0' })).toThrow(/WAYPOINT_BACKUP_DAYS/);
    expect(() => withEnv({ WAYPOINT_BACKUP_DAYS: 'a week' })).toThrow(/WAYPOINT_BACKUP_DAYS/);
  });

  it('warns a production server that does not say who runs it', () => {
    const env = withEnv({});
    const named = {
      ...env,
      isProd: true,
      WAYPOINT_URL: 'https://waypoint.example',
      WAYPOINT_CLIENT_IP_HEADER: 'x-real-ip',
    };
    expect(configWarnings(named).join(' ')).toMatch(/WAYPOINT_OPERATOR/);
    // …or that cannot send email, since nobody could then confirm an address and sign in.
    expect(configWarnings(named).join(' ')).toMatch(/EMAIL_FROM/);
    expect(
      configWarnings({
        ...named,
        WAYPOINT_OPERATOR: 'Example Trust',
        WAYPOINT_CONTACT_EMAIL: 'privacy@example.org',
        EMAIL_FROM: 'Waypoint <hello@example.org>',
        SMTP_URL: 'smtp://mail.example.org:587',
      }),
    ).toEqual([]);
    // Development never nags.
    expect(configWarnings({ ...env, isProd: false })).toEqual([]);
  });
});

describe('a production server', () => {
  const PROD_KEYS = ['NODE_ENV', 'WAYPOINT_URL', 'BETTER_AUTH_SECRET', 'WAYPOINT_KEK'] as const;
  const before = Object.fromEntries(PROD_KEYS.map((k) => [k, process.env[k]]));
  const production = (values: Partial<Record<(typeof PROD_KEYS)[number], string>>) => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      WAYPOINT_URL: 'https://waypoint.example',
      BETTER_AUTH_SECRET: 'a-long-random-secret-of-at-least-32-characters',
      WAYPOINT_KEK: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
      ...values,
    });
    resetEnvForTests();
    return getEnv();
  };
  afterEach(() => {
    for (const k of PROD_KEYS) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
    resetEnvForTests();
  });

  it('starts with an https address and strong secrets', () => {
    expect(production({}).isProd).toBe(true);
  });

  it('refuses a public address without https: the session cookie would travel in the clear', () => {
    expect(() => production({ WAYPOINT_URL: 'http://waypoint.example' })).toThrow(/https/);
    // A production build tried out on this machine is fine.
    expect(production({ WAYPOINT_URL: 'http://localhost:3000' }).isProd).toBe(true);
    expect(production({ WAYPOINT_URL: 'http://127.0.0.1:3100' }).isProd).toBe(true);
  });

  it('refuses a session secret short enough to guess', () => {
    expect(() => production({ BETTER_AUTH_SECRET: 'changeme' })).toThrow(/32/);
  });

  it('warns when its address is still this machine', () => {
    const env = production({ WAYPOINT_URL: 'http://localhost:3000' });
    expect(configWarnings(env).join(' ')).toMatch(/WAYPOINT_URL/);
    expect(configWarnings(production({})).join(' ')).not.toMatch(/WAYPOINT_URL/);
  });
});
