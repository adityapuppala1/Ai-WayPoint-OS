/**
 * Staff see what AI costs, feature by feature, in the admin console. Every name the judge
 * records usage under needs a label there in every language, or staff would see a code.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot } from '@waypoint/core/env';
import { locales } from '@waypoint/i18n';
import { describe, expect, it } from 'vitest';
import { JUDGE_FEATURES } from '../src/usage';

const root = findRepoRoot();

describe('the judge in the admin spending breakdown', () => {
  it('has a label for each of its features in all seven languages', () => {
    expect(locales).toHaveLength(7);
    for (const locale of locales) {
      const messages = JSON.parse(
        readFileSync(join(root, 'packages', 'i18n', 'messages', `${locale}.json`), 'utf8'),
      ) as { admin: { aiFeatures: Record<string, string> } };
      for (const feature of JUDGE_FEATURES) {
        const label = messages.admin.aiFeatures[feature];
        expect(label, `${locale}: admin.aiFeatures.${feature}`).toBeTruthy();
        expect(label).not.toContain('judge-');
      }
    }
  });

  it('says the same thing in each language, not the English copied over', () => {
    const label = (locale: string, feature: string) =>
      (
        JSON.parse(
          readFileSync(join(root, 'packages', 'i18n', 'messages', `${locale}.json`), 'utf8'),
        ) as { admin: { aiFeatures: Record<string, string> } }
      ).admin.aiFeatures[feature];
    for (const feature of JUDGE_FEATURES)
      for (const locale of locales.filter((l) => l !== 'en'))
        expect(label(locale, feature), `${locale}: ${feature}`).not.toBe(label('en', feature));
  });

  it('is listed by the admin page, which takes the names from here', () => {
    const page = readFileSync(
      join(root, 'apps', 'web', 'src', 'app', '(app)', 'admin', 'page.tsx'),
      'utf8',
    );
    expect(page).toMatch(/import \{[^}]*JUDGE_FEATURES[^}]*\} from '@waypoint\/ai'/);
    expect(page).toMatch(/const FEATURES[^;]*\.\.\.JUDGE_FEATURES/s);
  });
});
