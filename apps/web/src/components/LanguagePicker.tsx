'use client';

import { isLocale, type Locale, localeNames, locales } from '@waypoint/i18n';
import { SelectField } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { savePreferences } from '@/lib/preferences';

/** Language picker. Names are shown in their own language so people can find theirs. */
export function LanguagePicker({ signedIn, compact }: { signedIn: boolean; compact?: boolean }) {
  const t = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (!isLocale(next) || next === locale) return;
    // The cookie the pages are drawn from (the server sets it, so Safari keeps it), and, for
    // someone signed in, the profile their emails and other devices use.
    const cookie = savePreferences({ locale: next });
    const profile = signedIn
      ? fetch('/api/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        }).catch(() => undefined)
      : Promise.resolve();
    // Redrawn in the new language once both are in place.
    Promise.all([cookie, profile]).finally(() => startTransition(() => router.refresh()));
  };

  return (
    <SelectField
      label={t('language')}
      hideLabel={compact}
      options={locales.map((l: Locale) => ({
        id: l,
        label: localeNames[l],
        textValue: localeNames[l],
      }))}
      selectedKey={locale}
      onSelectionChange={(key) => change(String(key))}
      isDisabled={pending}
    />
  );
}
