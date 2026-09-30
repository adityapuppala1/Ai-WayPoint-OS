import { describe, expect, it } from 'vitest';
import {
  CIVIC_CHECKLISTS,
  COUNTRIES,
  EMERGENCY_NUMBERS,
  GOV_PORTALS,
  getChecklist,
  getEmergency,
  getReportChannels,
  getSupportResources,
  LEARNING_RESOURCES,
  ROLES,
  SCAM_PATTERNS,
  SCAM_REPORT_CHANNELS,
  SKILLS,
  SUPPORT_RESOURCES,
} from '../src';
import type { ScamCategory, SourceRef } from '../src/types';

const countryCodes = new Set(COUNTRIES.map((c) => c.code));
const skillIds = new Set(SKILLS.map((s) => s.id));
const DIALABLE = /^[+*#]?[\d][\d\s-]*$/;

const hasSources = (sources: SourceRef[]) =>
  sources.length > 0 &&
  sources.every(
    (s) =>
      /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt) && s.title.length > 3,
  );

const unique = <T>(xs: T[]) => new Set(xs).size === xs.length;

describe('countries and emergency numbers', () => {
  it('has unique ISO codes and currencies', () => {
    expect(unique(COUNTRIES.map((c) => c.code))).toBe(true);
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(c.languages.length).toBeGreaterThan(0);
    }
  });

  it('has sourced emergency numbers for every country', () => {
    for (const c of COUNTRIES) {
      const em = getEmergency(c.code);
      expect(em, `missing emergency numbers for ${c.code}`).toBeDefined();
      expect(em!.general ?? em!.ambulance ?? em!.police, c.code).toBeTruthy();
      expect(hasSources(em!.sources), c.code).toBe(true);
    }
    expect(unique(EMERGENCY_NUMBERS.map((e) => e.country))).toBe(true);
    for (const e of EMERGENCY_NUMBERS) {
      expect(countryCodes.has(e.country), e.country).toBe(true);
      for (const n of [e.general, e.police, e.ambulance, e.fire].filter(Boolean))
        expect(n).toMatch(/^\d{2,6}$/);
    }
  });
});

describe('health lines', () => {
  it('is well formed, sourced and only in known countries', async () => {
    const { HEALTH_LINES, HEALTH_SOURCES, getHealthLines } = await import('../src');
    expect(unique(HEALTH_LINES.map((l) => l.id))).toBe(true);
    for (const l of HEALTH_LINES) {
      expect(l.id.startsWith(`${l.country.toLowerCase()}-`), `${l.id} prefix`).toBe(true);
      expect(countryCodes.has(l.country), `${l.id} country`).toBe(true);
      expect(l.phone || l.url, `${l.id} has no contact`).toBeTruthy();
      if (l.phone) expect(l.phone, l.id).toMatch(DIALABLE);
      expect(hasSources(l.sources), l.id).toBe(true);
      expect(l.audience.length).toBeGreaterThan(10);
    }
    expect(Object.values(HEALTH_SOURCES).every((s) => s.url.startsWith('https://'))).toBe(true);
    expect(getHealthLines('gb').map((l) => l.phone)).toEqual(['111']);
    expect(getHealthLines('XX')).toEqual([]);
    expect(getHealthLines(undefined)).toEqual([]);
  });
});

describe('support resources', () => {
  it('is well formed and sourced', () => {
    expect(unique(SUPPORT_RESOURCES.map((r) => r.id))).toBe(true);
    for (const r of SUPPORT_RESOURCES) {
      expect(r.id).toMatch(/^[a-z0-9-]+$/);
      expect(r.country === 'ZZ' || countryCodes.has(r.country), `${r.id} country`).toBe(true);
      expect(r.phone || r.sms || r.url, `${r.id} has no contact`).toBeTruthy();
      if (r.phone) expect(r.phone, r.id).toMatch(DIALABLE);
      if (r.sms) expect(r.sms, r.id).toMatch(DIALABLE);
      expect(hasSources(r.sources), r.id).toBe(true);
      expect(r.id.startsWith(`${r.country.toLowerCase()}-`), `${r.id} prefix`).toBe(true);
    }
  });

  it('gives every country at least one service, plus global directories', () => {
    const missing = COUNTRIES.filter(
      (c) => !SUPPORT_RESOURCES.some((r) => r.country === c.code),
    ).map((c) => c.code);
    // Ethiopia has no verified national line yet — directories cover it.
    expect(missing).toEqual(['ET']);
    expect(getSupportResources('ET').some((r) => r.kind === 'directory')).toBe(true);
  });

  it('ranks crisis lines first for suicidal crises', () => {
    const [first] = getSupportResources('US', { kinds: ['crisis-line', 'text-line'] });
    expect(first?.id).toBe('us-988');
    const [inFirst] = getSupportResources('IN', { kinds: ['crisis-line'] });
    expect(inFirst?.id).toBe('in-tele-manas');
  });
});

describe('scams', () => {
  it('covers every scam category with usable advice', () => {
    const all: ScamCategory[] = [
      'job',
      'bank-kyc',
      'delivery',
      'investment',
      'crypto',
      'lottery-prize',
      'romance',
      'sextortion',
      'tech-support',
      'impersonation-authority',
      'digital-arrest',
      'loan-app',
      'utility-disconnection',
      'tax-refund',
      'government-scheme',
      'family-emergency',
      'marketplace',
      'rental',
      'charity',
      'phishing-link',
      'sim-swap-otp',
      'qr-code',
      'deepfake-voice',
      'other',
    ];
    const covered = new Set(SCAM_PATTERNS.map((p) => p.category));
    expect(all.filter((c) => !covered.has(c))).toEqual([]);
    expect(unique(SCAM_PATTERNS.map((p) => p.id))).toBe(true);
    for (const p of SCAM_PATTERNS) {
      expect(p.redFlags.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.whatToDo.length, p.id).toBeGreaterThanOrEqual(2);
      expect(hasSources(p.sources), p.id).toBe(true);
    }
  });

  it('has official report channels, with a global fallback', () => {
    for (const r of SCAM_REPORT_CHANNELS) {
      expect(r.country === 'ZZ' || countryCodes.has(r.country), r.name).toBe(true);
      expect(r.phone || r.url || r.what, r.name).toBeTruthy();
      expect(hasSources(r.sources), r.name).toBe(true);
    }
    expect(getReportChannels('IN')[0]?.phone).toBe('1930');
    expect(getReportChannels('BR').some((r) => r.country === 'ZZ')).toBe(true);
  });
});

describe('civic', () => {
  it('has a generic checklist for every life event', () => {
    const events = [
      'job-loss',
      'first-job',
      'moving-country',
      'moving-city',
      'new-baby',
      'bereavement',
      'retirement',
      'disability',
      'serious-illness',
      'starting-business',
      'disaster',
    ] as const;
    for (const e of events) expect(getChecklist(e)?.country, e).toBe('ZZ');
    for (const c of CIVIC_CHECKLISTS)
      expect(unique(c.items.map((i) => i.id)), `${c.event}/${c.country}`).toBe(true);
  });

  it('merges country items ahead of generic ones', () => {
    const inJobLoss = getChecklist('job-loss', 'IN')!;
    expect(inJobLoss.items[0]?.id).toBe('ncs-register');
    expect(inJobLoss.items.some((i) => i.id === 'check-benefits')).toBe(true);
  });

  it('lists only https portals for known countries', () => {
    for (const p of GOV_PORTALS) {
      expect(p.url).toMatch(/^https:\/\//);
      expect(countryCodes.has(p.country), p.country).toBe(true);
    }
  });
});

describe('skills, roles and resources', () => {
  it('only references known skills', () => {
    expect(unique(SKILLS.map((s) => s.id))).toBe(true);
    expect(unique(ROLES.map((r) => r.id))).toBe(true);
    for (const r of ROLES) {
      for (const s of r.skills) expect(skillIds.has(s), `${r.id} → ${s}`).toBe(true);
      expect(hasSources(r.sources), r.id).toBe(true);
    }
    for (const res of LEARNING_RESOURCES) {
      for (const s of res.skills) expect(skillIds.has(s), `${res.id} → ${s}`).toBe(true);
      expect(res.url).toMatch(/^https:\/\//);
    }
  });

  it('has at least one resource for most skills', () => {
    const taught = new Set(LEARNING_RESOURCES.flatMap((r) => r.skills));
    const untaught = SKILLS.filter((s) => !taught.has(s.id)).map((s) => s.id);
    expect(untaught.length / SKILLS.length).toBeLessThan(0.25);
  });
});

describe('phone links', () => {
  it('builds WhatsApp links from published local numbers', async () => {
    const { whatsappLink } = await import('../src/phone');
    expect(whatsappLink('0767 520 620', 'LK')).toBe('https://wa.me/94767520620');
    expect(whatsappLink('+91 9999 666 555', 'IN')).toBe('https://wa.me/919999666555');
    expect(whatsappLink('9151 1767', 'SG')).toBe('https://wa.me/6591511767');
    expect(whatsappLink('0110 212 1600', 'EG')).toBe('https://wa.me/201102121600');
  });

  it('gives every WhatsApp service a working link', async () => {
    const { SUPPORT_RESOURCES } = await import('../src/support');
    const { whatsappLink } = await import('../src/phone');
    for (const r of SUPPORT_RESOURCES.filter((x) => x.whatsapp)) {
      expect(whatsappLink(r.whatsapp as string, r.country), r.id).toMatch(
        /^https:\/\/wa\.me\/\d{8,15}$/,
      );
    }
  });
});

describe('translated names', () => {
  it('names every skill, role and family in every language, and nothing else', async () => {
    const { CONTENT_NAMES } = await import('../src/l10n');
    const { ROLES } = await import('../src/roles');
    const families = [...new Set(ROLES.map((r) => r.family))].sort();
    for (const [locale, n] of Object.entries(CONTENT_NAMES)) {
      expect(Object.keys(n.skills).sort(), `${locale} skills`).toEqual(
        SKILLS.map((s) => s.id).sort(),
      );
      expect(Object.keys(n.roles).sort(), `${locale} roles`).toEqual(ROLES.map((r) => r.id).sort());
      expect(Object.keys(n.families).sort(), `${locale} families`).toEqual(families);
      for (const v of [...Object.values(n.skills), ...Object.values(n.roles)]) {
        expect(v.trim(), locale).not.toBe('');
      }
    }
  });

  it('falls back to English by id', async () => {
    const { roleTitle, skillName, localizeRole } = await import('../src/l10n');
    const { ROLES } = await import('../src/roles');
    expect(skillName('spreadsheets', 'sw')).toBe('Lahajedwali');
    expect(skillName('spreadsheets', 'de')).toBe('Spreadsheets');
    expect(skillName('spreadsheets')).toBe('Spreadsheets');
    expect(roleTitle('plumber', 'pt')).toBe('Encanador');
    const r = localizeRole(ROLES[0] as (typeof ROLES)[number], 'hi');
    expect(r.id).toBe(ROLES[0]?.id);
    expect(r.title).not.toBe(ROLES[0]?.title);
  });
});
