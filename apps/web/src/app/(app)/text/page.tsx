import { channels } from '@waypoint/api';
import type { CountryCode } from '@waypoint/content';
import type { Locale } from '@waypoint/core';
import { channelReply } from '@waypoint/core/channels';
import { Icon, type IconName, LinkButton, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ltr } from '@/lib/bidi';
import { guessCountry } from '@/lib/server';
import styles from './text.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('byText');
  return { title: t('title'), description: t('metaDescription') };
}

const COMMANDS = ['help', 'check', 'ask', 'lang', 'country', 'ai', 'stop'] as const;

type Way = {
  key: 'sms' | 'whatsapp' | 'ussd';
  icon: IconName;
  shown: string;
  href: string;
  external?: boolean;
};

export default async function TextPage() {
  const [t, locale, country] = await Promise.all([
    getTranslations('byText'),
    getLocale(),
    guessCountry(),
  ]);
  const reach = channels.publicChannels();
  const ways: Way[] = [];
  if (reach.sms) ways.push({ key: 'sms', icon: 'text', ...reach.sms });
  if (reach.whatsapp)
    ways.push({ key: 'whatsapp', icon: 'text', external: true, ...reach.whatsapp });
  if (reach.ussd) ways.push({ key: 'ussd', icon: 'phone', ...reach.ussd });

  // The sample is answered by the same code that answers real texts, in this language.
  const sample = t('sampleCheck');
  const reply = channelReply(
    sample,
    {
      locale: locale as Locale,
      country: (country as CountryCode | null) ?? null,
      optedOut: false,
      aiAllowed: false,
      isNew: false,
    },
    { channel: 'sms', site: 'waypoint', externalAi: false, localAi: false },
  );

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      {ways.length ? (
        <section aria-labelledby="ways-title" className="wp-stack">
          <h2 id="ways-title" className="wp-visually-hidden">
            {t('waysTitle')}
          </h2>
          <ul className={styles.ways}>
            {ways.map((w) => (
              <li key={w.key} className={styles.way}>
                <p className={styles.wayHead}>
                  <Icon name={w.icon} size={20} />
                  {t(`${w.key}.title`)}
                </p>
                <p className={styles.number}>
                  {/* Numbers read left to right in every language. */}
                  <bdi dir="ltr">{w.shown}</bdi>
                </p>
                <p className={`wp-secondary ${styles.wayBody}`}>{t(`${w.key}.body`)}</p>
                <LinkButton
                  href={w.href}
                  variant="primary"
                  className={styles.wayAction}
                  {...(w.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {w.key === 'ussd'
                    ? t('ussd.action', { code: ltr(w.shown) })
                    : t(`${w.key}.action`)}
                </LinkButton>
              </li>
            ))}
          </ul>
          <p className="wp-meta">{t('cost')}</p>
        </section>
      ) : (
        <Notice
          tone="info"
          title={t('noneTitle')}
          actions={
            <LinkButton href={'/support' as Route} variant="secondary" icon="support">
              {t('noneAction')}
            </LinkButton>
          }
        >
          {t('noneBody')}
        </Notice>
      )}

      <div className={styles.grid}>
        <Panel title={t('tryTitle')} description={t('tryLead')} as="section">
          <ol className={styles.thread}>
            <li className={styles.bubble} data-from="person">
              <span className="wp-visually-hidden">{t('you')}: </span>
              {sample}
            </li>
            {reply.messages.map((m) => (
              <li key={m} className={styles.bubble} data-from="waypoint">
                <span className="wp-visually-hidden">Waypoint: </span>
                {m}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={t('commandsTitle')} description={t('commandsLead')} as="section">
          <dl className={styles.commands}>
            {COMMANDS.map((k) => (
              <div key={k} className={styles.command}>
                <dt>
                  <span className={styles.word}>{t(`commands.${k}.word`)}</span>
                </dt>
                <dd>{t(`commands.${k}.what`)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className={styles.grid}>
        <Panel title={t('privacyTitle')} tone="quiet" as="section">
          <p className={styles.withIcon}>
            <Icon name="lock" size={20} />
            <span>{t('privacyBody')}</span>
          </p>
        </Panel>
        <Panel title={t('aiTitle')} tone="quiet" as="section">
          <p className={styles.withIcon}>
            <Icon name="ask" size={20} />
            <span>{t('aiBody')}</span>
          </p>
        </Panel>
      </div>

      <section className={styles.danger} aria-labelledby="danger-title">
        <h2 id="danger-title" className={styles.dangerTitle}>
          {t('dangerTitle')}
        </h2>
        <p>{t('dangerBody')}</p>
        <p>
          <Link href={'/support' as Route}>{t('noneAction')}</Link>
        </p>
      </section>
    </div>
  );
}
