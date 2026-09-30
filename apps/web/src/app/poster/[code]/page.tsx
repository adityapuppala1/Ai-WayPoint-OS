import { ApiError, org } from '@waypoint/api';
import { getEnv } from '@waypoint/core/env';
import { dbReady, getDb } from '@waypoint/db';
import { isLocale, textDirection } from '@waypoint/i18n';
import { Icon, ModuleMark } from '@waypoint/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PosterToolbar } from '@/components/join/PosterToolbar';
import styles from '@/components/join/poster.module.css';
import { QrCode } from '@/components/org/QrCode';
import { pageRateLimit } from '@/lib/server';

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('join');
  return { title: t('posterTitle'), robots: { index: false } };
}

/** A printable poster for a programme. Public: it shows only what the join page shows. */
export default async function PosterPage({ params, searchParams }: Props) {
  const [{ code }, { lang }] = await Promise.all([params, searchParams]);
  await pageRateLimit('poster', 120, 3600, `/poster/${encodeURIComponent(code)}`);
  const locale = isLocale(lang) ? lang : await getLocale();
  await dbReady();
  let preview: org.JoinPreview;
  try {
    preview = await org.joinPreview(getDb(), null, code, locale);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const t = await getTranslations({ locale, namespace: 'join' });
  const base = getEnv().WAYPOINT_URL;
  const joinUrl = `${base}/join/${preview.code}`;
  const site = `${new URL(base).host}/join`;
  const organisation = preview.organisation.name;

  return (
    <main id="main" className={styles.page}>
      <PosterToolbar lang={isLocale(locale) ? locale : 'en'} />
      <article className={styles.poster} lang={locale} dir={textDirection(locale)}>
        <p className={styles.brand}>
          <ModuleMark module="org" size="md" tone="solid" />
          <span>Waypoint · {organisation}</span>
        </p>
        <div className="wp-stack">
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1 className={styles.title} dir="auto">
            {preview.programme.name}
          </h1>
          {preview.programme.description ? (
            <p className={styles.description} dir="auto">
              {preview.programme.description}
            </p>
          ) : null}
        </div>
        <div className={styles.join}>
          <QrCode value={joinUrl} label={t('posterQr')} className={styles.qr} />
          <div className={styles.joinText}>
            <p className={styles.scan}>{t('posterScan')}</p>
            <p className={styles.or}>
              {t.rich('posterOr', { site: () => <strong dir="ltr">{site}</strong> })}
            </p>
            <p className={styles.code} dir="ltr">
              {preview.codeDisplay}
            </p>
          </div>
        </div>
        <p className={styles.free}>{t('posterFree')}</p>
        <p className={styles.privacy}>
          <Icon name="lock" size={22} />
          <span>{t('posterPrivacy', { organisation, k: preview.k })}</span>
        </p>
      </article>
    </main>
  );
}
