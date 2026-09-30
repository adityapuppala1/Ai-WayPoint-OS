import { COUNTRIES, SKILLS, skillName } from '@waypoint/content';
import { safeNextPath } from '@waypoint/core';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { PublicShell } from '@/components/shell/PublicShell';
import { getViewer, guessCountry } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('start');
  return { title: t('title') };
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Only a path on this site is carried through; anything else ends on Today.
  const next = safeNextPath((await searchParams).next);
  const [viewer, locale, country] = await Promise.all([getViewer(), getLocale(), guessCountry()]);
  const tz = (await cookies()).get('wp-tz')?.value;
  const names = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  const countries = COUNTRIES.map((c) => ({
    code: c.code,
    name: names.of(c.code) ?? c.name,
    currency: c.currency,
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
  const p = viewer?.profile;
  return (
    <PublicShell hideSignIn={Boolean(viewer)}>
      <Onboarding
        signedIn={Boolean(viewer)}
        next={next}
        countries={countries}
        skills={SKILLS.map((s) => ({
          id: s.id,
          name: skillName(s.id, locale),
          alt: locale === 'en' ? undefined : s.name,
          category: s.category,
        }))}
        initial={{
          displayName: p?.displayName ?? '',
          country: p?.country ?? country ?? '',
          timezone: p?.timezone && p.timezone !== 'UTC' ? p.timezone : (tz ?? ''),
          situation: p?.situation ?? null,
          lifeStage: p?.lifeStage ?? null,
          workType: p?.workType ?? null,
          hoursPerWeek: p?.hoursPerWeek ?? 5,
          learningBudget: p?.learningBudget ?? 'free',
          attentionBudget: p?.attentionBudget ?? 1,
          consents: viewer?.consents ?? null,
        }}
      />
    </PublicShell>
  );
}
