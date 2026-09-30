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

  it('takes the default for a number left empty, as every line in .env.example is', () => {
    const before = {
      hour: process.env.WAYPOINT_TEXT_REPLIES_PER_HOUR,
      day: process.env.WAYPOINT_TEXT_REPLIES_PER_DAY,
    };
    try {
      process.env.WAYPOINT_TEXT_REPLIES_PER_HOUR = '';
      process.env.WAYPOINT_TEXT_REPLIES_PER_DAY = ' ';
      const env = withEnv({});
      expect(env.WAYPOINT_TEXT_REPLIES_PER_HOUR).toBe(2000);
      expect(env.WAYPOINT_TEXT_REPLIES_PER_DAY).toBe(20_000);
      process.env.WAYPOINT_TEXT_REPLIES_PER_HOUR = '50';
      expect(withEnv({}).WAYPOINT_TEXT_REPLIES_PER_HOUR).toBe(50);
    } finally {
      for (const [key, value] of [
        ['WAYPOINT_TEXT_REPLIES_PER_HOUR', before.hour],
        ['WAYPOINT_TEXT_REPLIES_PER_DAY', before.day],
      ] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
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

describe('the judge (TypeSafe Jev) settings', () => {
  const JUDGE_KEYS = ['TYPESAFE_API_KEY', 'AI_JUDGE_MODEL', 'AI_JUDGE_LOCALES'] as const;
  const before = Object.fromEntries(JUDGE_KEYS.map((k) => [k, process.env[k]]));
  const judge = (values: Partial<Record<(typeof JUDGE_KEYS)[number], string>>) => {
    for (const k of JUDGE_KEYS) delete process.env[k];
    Object.assign(process.env, values);
    resetEnvForTests();
    return getEnv();
  };
  afterEach(() => {
    for (const k of JUDGE_KEYS) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
    resetEnvForTests();
  });

  it('is off until a key is set, pinned to one version, and for English only', () => {
    const env = judge({});
    expect(env.TYPESAFE_API_KEY).toBeUndefined();
    expect(env.AI_JUDGE_MODEL).toBe('jev-1.13.0');
    expect(env.AI_JUDGE_LOCALES).toEqual(['en']);
  });

  it('reads the key, another pinned version and a list of languages', () => {
    const env = judge({
      TYPESAFE_API_KEY: ' ts_live_example ',
      AI_JUDGE_MODEL: 'jev-1.14.2',
      AI_JUDGE_LOCALES: 'en, ES ,sw,en',
    });
    expect(env.TYPESAFE_API_KEY).toBe('ts_live_example');
    expect(env.AI_JUDGE_MODEL).toBe('jev-1.14.2');
    expect(env.AI_JUDGE_LOCALES).toEqual(['en', 'es', 'sw']);
  });

  it('takes the defaults for values left empty, as a line in .env.example would be', () => {
    const env = judge({ TYPESAFE_API_KEY: '', AI_JUDGE_MODEL: ' ', AI_JUDGE_LOCALES: '' });
    expect(env.TYPESAFE_API_KEY).toBeUndefined();
    expect(env.AI_JUDGE_MODEL).toBe('jev-1.13.0');
    expect(env.AI_JUDGE_LOCALES).toEqual(['en']);
  });

  it('refuses an alias or a partial version: every threshold was set against one version', () => {
    // An alias moves whenever TypeSafe ships a release; "jev-1.13" could be any 1.13.x.
    for (const alias of ['jev-latest', 'jev-preview', 'jev-1.13', 'jev'])
      expect(() => judge({ AI_JUDGE_MODEL: alias }), alias).toThrow(/AI_JUDGE_MODEL/);
    expect(judge({ AI_JUDGE_MODEL: 'jev-2.0.10' }).AI_JUDGE_MODEL).toBe('jev-2.0.10');
  });

  it('refuses a model name or a language list that cannot be one', () => {
    expect(() => judge({ AI_JUDGE_MODEL: 'jev 1.13' })).toThrow(/AI_JUDGE_MODEL/);
    expect(() => judge({ AI_JUDGE_LOCALES: 'english, please' })).toThrow(/AI_JUDGE_LOCALES/);
    expect(() => judge({ AI_JUDGE_LOCALES: 'en;es' })).toThrow(/AI_JUDGE_LOCALES/);
  });
});

describe('a production server', () => {
  const PROD_KEYS = ['NODE_ENV', 'WAYPOINT_URL', 'BETTER_AUTH_SECRET', 'WAYPOINT_KEK'] as const;
  const before = Object.fromEntries(PROD_KEYS.map((k) => [k, process.env[k]]));
  const production = (values: Partial<Record<(typeof PROD_KEYS)[number], string>>) => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      WAYPOINT_URL: 'https://waypoint.example',
      BETTER_AUTH_SECRET: 'ci-only-secret-not-for-production-use-000000',
      WAYPOINT_KEK: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
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
