import type { HealthView } from '@waypoint/api/client';
import { HEALTH_SOURCES } from '@waypoint/content';
import { Icon, LinkButton } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ltr } from '@/lib/bidi';
import styles from './health.module.css';

const FLAGS = {
  stroke: ['face', 'arms', 'speech', 'time'],
  heart: ['chest', 'breath', 'other'],
  allergy: ['swelling', 'breathing', 'faint'],
  heatstroke: ['signs', 'confusion'],
} as const;

const ACTIONS: Partial<Record<keyof typeof FLAGS, 'action'>> = {
  allergy: 'action',
  heatstroke: 'action',
};

/**
 * Where to get care: the signs that mean "call now", then non-emergency help that was checked
 * against a source for this country, then support for how you feel.
 */
export async function CareGuide({ care }: { care: HealthView['care'] }) {
  const [t, nav, format, locale] = await Promise.all([
    getTranslations('health'),
    getTranslations('nav'),
    getFormatter(),
    getLocale(),
  ]);
  const emergency = care.emergencyNumber;
  // Dialled locally: national short codes (111, 116117) can't be called from abroad anyway.
  const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
  const sources = [
    HEALTH_SOURCES.stroke,
    HEALTH_SOURCES.heartAttack,
    HEALTH_SOURCES.anaphylaxis,
    HEALTH_SOURCES.heatstroke,
    ...care.lines.flatMap((l) => l.sources),
  ];

  return (
    <div className="wp-stack">
      <section className={styles.emergency} aria-labelledby="care-emergency">
        <div className={styles.emergencyHead}>
          <h3 id="care-emergency">
            {emergency
              ? t('emergencyTitle', { number: ltr(emergency) })
              : t('emergencyTitleNoNumber')}
          </h3>
          {emergency ? (
            <LinkButton href={`tel:${emergency}`} variant="danger" icon="phone">
              {t('call', { phone: emergency })}
            </LinkButton>
          ) : null}
        </div>
        <div className={styles.flags} lang={locale}>
          {(Object.keys(FLAGS) as Array<keyof typeof FLAGS>).map((flag) => (
            <div key={flag} className={styles.flag}>
              <h4>{t(`flags.${flag}.title`)}</h4>
              <ul>
                {FLAGS[flag].map((item) => (
                  <li key={item}>{t(`flags.${flag}.${item}` as 'flags.stroke.face')}</li>
                ))}
              </ul>
              {ACTIONS[flag] ? (
                <p className={styles.flagAction}>
                  {t(`flags.${flag}.action` as 'flags.allergy.action')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="wp-secondary">{t('noDrive')}</p>
      </section>

      <section className="wp-stack" aria-labelledby="care-other">
        <h3 id="care-other" className={styles.subhead}>
          {t('notEmergencyTitle')}
        </h3>
        {care.lines.length ? (
          <ul className={styles.lines}>
            {care.lines.map((l) => (
              <li key={l.id} className={styles.line} lang={l.languages?.[0]}>
                <p className={styles.lineName}>{l.name}</p>
                <p className="wp-secondary" lang="en">
                  {l.audience}
                  {l.notes ? ` ${l.notes}` : ''}
                </p>
                {/* Two facts, one line each. */}
                {l.hours ? (
                  <p className="wp-meta">{t('hoursAvailable', { hours: l.hours })}</p>
                ) : null}
                {l.free ? <p className="wp-meta">{t('free')}</p> : null}
                <div className="wp-row">
                  {l.phone ? (
                    <LinkButton href={tel(l.phone)} variant="secondary" icon="phone" size="sm">
                      {t('call', { phone: ltr(l.phone) })}
                    </LinkButton>
                  ) : null}
                  {l.url ? (
                    <LinkButton
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="quiet"
                      icon="external"
                      size="sm"
                    >
                      {t('website')}
                    </LinkButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-secondary">{t('notEmergencyNone')}</p>
        )}
        {care.poison ? (
          <div className={styles.line}>
            <p className={styles.lineName}>{t('poisonTitle')}</p>
            <p className="wp-secondary">{care.poison.name}</p>
            {care.poison.phone ? (
              <div className="wp-row">
                <LinkButton
                  href={tel(care.poison.phone)}
                  variant="secondary"
                  icon="phone"
                  size="sm"
                >
                  {t('call', { phone: ltr(care.poison.phone) })}
                </LinkButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="wp-stack" aria-labelledby="care-mind">
        <h3 id="care-mind" className={styles.subhead}>
          {t('mindTitle')}
        </h3>
        <p className="wp-secondary">{t('mindBody')}</p>
        <div className="wp-row">
          <LinkButton href={'/support' as Route} variant="support" icon="support" size="sm">
            {t('mindAction')}
          </LinkButton>
          <Link href={'/mind' as Route} className={`wp-secondary ${styles.inlineLink}`}>
            <Icon name="mind" size={16} /> {nav('mind')}
          </Link>
        </div>
      </section>

      <details>
        <summary className="wp-secondary">{t('sourcesTitle')}</summary>
        <ul className={styles.sources}>
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" lang="en">
                {s.title}
              </a>{' '}
              <span className="wp-meta">
                {t('checked', {
                  date: format.dateTime(new Date(`${s.checkedAt}T12:00:00Z`), {
                    dateStyle: 'medium',
                  }),
                })}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
