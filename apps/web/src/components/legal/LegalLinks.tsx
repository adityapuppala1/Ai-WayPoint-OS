import type { Route } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/** The privacy notice and terms, linked from page footers and settings. */
export async function LegalLinks({ className }: { className?: string }) {
  const t = await getTranslations('legal');
  return (
    <p className={className}>
      <Link href={'/privacy' as Route}>{t('privacyLink')}</Link>
      <Link href={'/terms' as Route}>{t('termsLink')}</Link>
    </p>
  );
}
