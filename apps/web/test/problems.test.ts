import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiProblem, secondCheckRefusal } from '../src/lib/api';

const LOCALES = ['en', 'hi', 'es', 'fr', 'pt', 'ar', 'sw'] as const;

const admin = (locale: string) =>
  (
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../../packages/i18n/messages', `${locale}.json`),
        'utf8',
      ),
    ) as { admin: Record<string, string> }
  ).admin;

// The server's words for these refusals are English only (services/forecasts.ts).
const refused = {
  checked: new ApiProblem(409, 'checked', 'A second person has already confirmed this outcome.'),
  'same-person': new ApiProblem(
    403,
    'same-person',
    'The second check has to come from a different member of staff than the one who recorded the outcome.',
  ),
  'not-judged': new ApiProblem(409, 'not-judged', 'There is no outcome to confirm yet.'),
};

describe('a refused second check', () => {
  it('is said in the staff member’s own language, not in the server’s English', () => {
    for (const [code, err] of Object.entries(refused)) {
      const key = secondCheckRefusal(err);
      expect(key, code).not.toBeNull();
      for (const locale of LOCALES) {
        const text = admin(locale)[key as string];
        expect(text, `${locale} ${code}`).toBeTruthy();
        if (locale !== 'en') expect(text, `${locale} ${code}`).not.toBe(admin('en')[key as string]);
      }
    }
    // Three reasons, three different sentences.
    expect(new Set(Object.values(refused).map(secondCheckRefusal)).size).toBe(3);
  });

  it('leaves any other failure to the general messages', () => {
    expect(secondCheckRefusal(new ApiProblem(0, 'network', 'network'))).toBeNull();
    expect(secondCheckRefusal(new ApiProblem(403, 'forbidden', 'No.'))).toBeNull();
    expect(secondCheckRefusal(new ApiProblem(500, 'error', 'Server error'))).toBeNull();
    expect(secondCheckRefusal(new Error('checked'))).toBeNull();
  });
});
