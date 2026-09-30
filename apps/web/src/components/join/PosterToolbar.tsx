'use client';

import { type Locale, localeNames, locales } from '@waypoint/i18n';
import { Button, SelectField } from '@waypoint/ui';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import styles from './poster.module.css';

/** Poster controls (never printed): the poster's language and a print button. */
export function PosterToolbar({ lang }: { lang: Locale }) {
  const t = useTranslations('join');
  const shell = useTranslations('shell');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarText}>
        <p className="wp-strong">{t('posterTitle')}</p>
        <p className="wp-secondary">{t('posterHint')}</p>
      </div>
      <div className={styles.toolbarActions}>
        <SelectField
          label={shell('language')}
          selectedKey={lang}
          isDisabled={pending}
          options={locales.map((l: Locale) => ({
            id: l,
            label: localeNames[l],
            textValue: localeNames[l],
          }))}
          onSelectionChange={(k) => {
            if (!k || k === lang) return;
            startTransition(() => router.replace(`${pathname}?lang=${String(k)}` as Route));
          }}
        />
        <Button variant="primary" icon="print" onPress={() => window.print()}>
          {t('posterPrint')}
        </Button>
      </div>
    </div>
  );
}
