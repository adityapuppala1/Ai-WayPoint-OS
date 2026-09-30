'use client';

import { isLocale, LOCALE_COOKIE, type Locale, localeNames, locales } from '@waypoint/i18n';
import { SelectField } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

/** Language picker. Names are shown in their own language so people can find theirs. */
export function LanguagePicker({ signedIn, compact }: { signedIn: boolean; compact?: boolean }) {
  const t = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (!isLocale(next) || next === locale) return;
    // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie read on the server
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const save = signedIn
      ? fetch('/api/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        }).catch(() => undefined)
      : Promise.resolve();
    save.finally(() => startTransition(() => router.refresh()));
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
