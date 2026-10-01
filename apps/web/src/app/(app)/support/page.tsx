import { channels, support } from '@waypoint/api';
import { COUNTRIES, normalizeCountry } from '@waypoint/content';
import { Icon, LinkButton, PageHeader, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CountryPicker } from '@/components/support/CountryPicker';
import { ltr } from '@/lib/bidi';
import { guessCountry } from '@/lib/server';
import styles from './support.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support');
  return { title: t('title'), description: t('lead') };
}

type KindKey =
  | 'crisis-line'
  | 'text-line'
  | 'chat'
  | 'mental-health'
  | 'domestic-violence'
  | 'child-helpline'
  | 'elder-abuse'
  | 'poison'
  | 'directory';

function ServiceRow({
  r,
  labels,
}: {
  r: support.SupportResourceView;
  labels: {
    call: string;
    text: string;
    website: string;
    hours: string;
    free: string;
    kind: string;
  };
}) {
  return (
    <li className={styles.service}>
      <div className={styles.serviceHead}>
        <h3 className={styles.serviceName}>{r.name}</h3>
        <p className="wp-meta">{labels.kind}</p>
      </div>
      {r.audience ? <p className="wp-secondary">{r.audience}</p> : null}
      <dl className="wp-dl">
        {r.hours ? (
          <>
            <dt>{labels.hours}</dt>
            <dd>{r.hours}</dd>
          </>
        ) : null}
      </dl>
      {r.free ? <p className="wp-meta">{labels.free}</p> : null}
      <div className={styles.actions}>
        {r.telHref ? (
          <LinkButton href={r.telHref} variant="support" icon="phone">
            {`${labels.call} ${ltr(r.phone ?? '')}`}
          </LinkButton>
        ) : null}
        {r.smsHref ? (
          <LinkButton href={r.smsHref} variant="secondary" icon="text">
            {r.smsKeyword
              ? `${labels.text} ${r.smsKeyword} — ${ltr(r.sms ?? '')}`
              : `${labels.text} ${ltr(r.sms ?? '')}`}
          </LinkButton>
        ) : null}
        {r.whatsappHref ? (
          <LinkButton
            href={r.whatsappHref}
            variant="secondary"
            icon="text"
            target="_blank"
            rel="noopener noreferrer"
          >
            {`WhatsApp ${ltr(r.whatsapp ?? '')}`}
          </LinkButton>
        ) : null}
        {r.url ? (
          <LinkButton
            href={r.url}
            variant="quiet"
            icon="external"
            target="_blank"
            rel="noopener noreferrer"
          >
            {labels.website}
          </LinkButton>
        ) : null}
      </div>
    </li>
  );
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: q } = await searchParams;
  const locale = await getLocale();
  const country = normalizeCountry(q) ?? (await guessCountry());
  const t = await getTranslations('support');
  const kinds = await getTranslations('supportKinds');
  const dir = support.supportDirectory(country, { language: locale });
  const names = new Intl.DisplayNames([locale, 'en'], { type: 'region' });
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: names.of(c.code) ?? c.name })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );
  const countryName = dir.country ? (names.of(dir.country) ?? dir.countryName) : null;
  const em = dir.emergency;
  const reach = channels.publicChannels();
  const byText = Boolean(reach.sms || reach.whatsapp || reach.ussd);
  const labels = (r: support.SupportResourceView) => ({
    call: t('call'),
    text: t('text'),
    website: t('website'),
    hours: t('hours'),
    free: t('free'),
    kind: kinds(r.kind as KindKey),
  });

  return (
    <div className="wp-page">
      <PageHeader module="support" title={t('title')} lead={t('lead')} />

      <section className={styles.danger} aria-labelledby="danger-title">
        <h2 id="danger-title" className={styles.dangerTitle}>
          {t('dangerTitle')}
        </h2>
        {em?.general ? (
          <>
            <p>{t('dangerBody', { number: ltr(em.general) })}</p>
            <div className={styles.actions}>
              <LinkButton href={`tel:${em.general}`} variant="support" size="lg" icon="phone">
                {t('callNumber', { number: ltr(em.general) })}
              </LinkButton>
            </div>
          </>
        ) : (
          <p>{t('dangerNoNumber')}</p>
        )}
        {em && (em.police || em.ambulance || em.fire) ? (
          <dl className={styles.numbers}>
            {em.police ? (
              <div>
                <dt>{t('police')}</dt>
                <dd>
                  <a href={`tel:${em.police}`}>{ltr(em.police)}</a>
                </dd>
              </div>
            ) : null}
            {em.ambulance ? (
              <div>
                <dt>{t('ambulance')}</dt>
                <dd>
                  <a href={`tel:${em.ambulance}`}>{ltr(em.ambulance)}</a>
                </dd>
              </div>
            ) : null}
            {em.fire ? (
              <div>
                <dt>{t('fire')}</dt>
                <dd>
                  <a href={`tel:${em.fire}`}>{ltr(em.fire)}</a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {em?.notes ? <p className="wp-secondary">{em.notes}</p> : null}
      </section>

      <div className={styles.picker}>
        <CountryPicker label={t('country')} countries={countries} value={dir.country} />
      </div>

      <Panel
        title={
          countryName ? t('servicesTitleCountry', { country: countryName }) : t('servicesTitle')
        }
        as="section"
      >
        {dir.services.length ? (
          <ul className={styles.list}>
            {dir.services.map((r) => (
              <ServiceRow key={r.id} r={r} labels={labels(r)} />
            ))}
          </ul>
        ) : (
          <p className="wp-secondary">{t('noServices')}</p>
        )}
      </Panel>

      <Panel title={t('directoriesTitle')} as="section">
        <ul className={styles.list}>
          {dir.directories.map((r) => (
            <ServiceRow key={r.id} r={r} labels={labels(r)} />
          ))}
        </ul>
      </Panel>

      <Panel title={t('groundingTitle')} tone="quiet" as="section">
        <p>{t('groundingBody')}</p>
      </Panel>

      {byText ? (
        <Panel title={t('textTitle')} tone="quiet" as="section">
          <div className="wp-stack">
            <p>{t('textBody')}</p>
            <div className={styles.actions}>
              <LinkButton href={'/text' as Route} variant="secondary" icon="text">
                {t('textAction')}
              </LinkButton>
            </div>
          </div>
        </Panel>
      ) : null}

      <footer className={styles.foot}>
        <p>
          <Icon name="safe" size={16} /> {t('verified')}
        </p>
        <p>{t('notAlone')}</p>
      </footer>
    </div>
  );
}
