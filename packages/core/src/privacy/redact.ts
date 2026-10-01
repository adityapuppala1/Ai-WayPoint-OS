/**
 * PII redaction applied before any text leaves Waypoint for an external AI provider,
 * and before anything is written to logs. Conservative: validated where a checksum exists
 * (cards, Aadhaar, IBAN) so ordinary numbers survive.
 */
export type PIIKind =
  | 'email'
  | 'phone'
  | 'card'
  | 'iban'
  | 'aadhaar'
  | 'pan'
  | 'ssn'
  | 'upi'
  | 'ip'
  | 'passport'
  | 'bvn';

export interface RedactionResult {
  text: string;
  found: Array<{ kind: PIIKind; count: number }>;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// Verhoeff checksum (used by Aadhaar numbers).
const V_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const V_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = V_D[c]![V_P[i % 8]![Number(rev[i])]!]!;
  return c === 0;
}

function ibanValid(raw: string): boolean {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

interface Detector {
  kind: PIIKind;
  re: RegExp;
  validate?: (match: string) => boolean;
}

const DETECTORS: Detector[] = [
  { kind: 'email', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  {
    kind: 'upi',
    re: /\b[a-z0-9._-]{2,}@(?:ok\w+|ybl|ibl|axl|paytm|upi|apl|icici|sbi|hdfcbank|axisbank|kotak|yapl|ptyes|ptsbi|pthdfc|ptaxis|jupiteraxis|fbl|waaxis|wahdfcbank|wasbi|waicici)\b/gi,
  },
  {
    kind: 'iban',
    re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g,
    validate: ibanValid,
  },
  {
    kind: 'card',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: (m) => luhnValid(m.replace(/\D/g, '')) && /^[2-6]/.test(m.replace(/\D/g, '')),
  },
  {
    kind: 'aadhaar',
    re: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g,
    validate: (m) => verhoeffValid(m.replace(/\D/g, '')),
  },
  { kind: 'pan', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g },
  { kind: 'ssn', re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { kind: 'bvn', re: /\bBVN[:\s#-]*\d{11}\b/gi },
  { kind: 'passport', re: /\bpassport(?: (?:no|number|#))?[:\s#-]*[A-Z0-9]{6,9}\b/gi },
  { kind: 'ip', re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  // International and local phone numbers: 7–15 digits, allowing spaces, dashes, dots and brackets.
  {
    kind: 'phone',
    // Not only after a space: `(0712345678)`, `tel:+254…`, `"to":"+254…"` and `to=+254…` are
    // how numbers appear in provider errors and logs. A number never starts or ends inside a word.
    re: /(?<![\w+])(?:\+|00)?\d{1,4}?[\s.-]?\(?\d{2,5}\)?(?:[\s.-]?\d{2,5}){1,4}(?!\w)/g,
    validate: (m) => {
      const d = m.replace(/\D/g, '');
      if (d.length < 7 || d.length > 15) return false;
      // Dates (12.05.2024, 2024-05-12) and plain decimals are not phone numbers.
      const s = m.trim();
      if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(s) || /^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(s))
        return false;
      if (/^\d+\.\d{1,2}$/.test(s)) return false;
      // A timestamp ("2024-05-12 10:30") starts with a date and carries on.
      if (/^\d{4}-\d{2}-\d{2}(?:\D|$)/.test(s)) return false;
      return true;
    },
  },
];

const TOKEN: Record<PIIKind, string> = {
  email: '[email]',
  phone: '[phone]',
  card: '[card]',
  iban: '[bank account]',
  aadhaar: '[id number]',
  pan: '[tax id]',
  ssn: '[id number]',
  upi: '[payment id]',
  ip: '[ip address]',
  passport: '[passport]',
  bvn: '[bank id]',
};

export function redactPII(text: string, keep: PIIKind[] = []): RedactionResult {
  let out = text;
  const counts = new Map<PIIKind, number>();
  for (const d of DETECTORS) {
    if (keep.includes(d.kind)) continue;
    out = out.replace(d.re, (m) => {
      if (d.validate && !d.validate(m)) return m;
      counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
      return TOKEN[d.kind];
    });
  }
  return { text: out, found: [...counts.entries()].map(([kind, count]) => ({ kind, count })) };
}
