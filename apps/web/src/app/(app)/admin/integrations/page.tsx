import { integrations } from '@waypoint/api';
import { integrationById } from '@waypoint/core/console';
import { getEnv } from '@waypoint/core/env';
import { Icon } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';
import styles from '@/components/admin/admin.module.css';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.int');
  return { title: t('title'), robots: { index: false } };
}

const GROUPS = ['ai', 'judge', 'texting', 'email'] as const;

/**
 * Outside services: one card each, grouped by what they are for. The summary says how many are
 * in use, how many need attention, and what AI has cost this month against its limit.
 */
export default async function IntegrationsPage() {
  const viewer = await requireConsole('integrations', '/admin/integrations');
  const [t, format, data] = await Promise.all([
    getTranslations('admin.int'),
    getFormatter(),
    integrations.integrationsView(viewer.db),
  ]);
  const at = new Date().toISOString();
  const services = data.integrations.filter((i) => !i.id.endsWith('-settings'));
  const inUse = services.filter((i) => i.configured).length;
  const attention = services.filter((i) => i.status === 'failing').length;
  const budget = getEnv().AI_MONTHLY_BUDGET_USD;
  const usd = (v: number) => format.number(v, { style: 'currency', currency: 'USD' });
  const share = budget > 0 ? Math.min(1, data.monthSpendUsd / budget) : 0;
  const name = (id: string) => integrationById(id)?.name ?? t(`names.${id}` as 'names.ai-settings');

  return (
    <section className="wp-stack" aria-labelledby="int-title">
      <header className={styles.sectionHead}>
        <h2 id="int-title">{t('title')}</h2>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      <ul className={styles.tiles} aria-label={t('title')}>
        <li className={styles.tile}>
          <span className={styles.tileValue}>{format.number(inUse)}</span>
          <span className={styles.tileLabel}>{t('inUse', { n: inUse })}</span>
        </li>
        <li className={styles.tile} data-tone={attention ? 'caution' : undefined}>
          <span className={styles.tileValue}>
            <Icon name={attention ? 'caution' : 'safe'} size={20} /> {format.number(attention)}
          </span>
          <span className={styles.tileLabel}>
            {attention ? t('needAttention', { n: attention }) : t('allWell')}
          </span>
        </li>
        <li className={styles.tile}>
          <span className={styles.tileValue}>{usd(data.monthSpendUsd)}</span>
          <span className={styles.tileLabel}>
            {t('spend')}, {budget > 0 ? t('ofBudget', { budget: usd(budget) }) : t('noBudget')}
          </span>
          {budget > 0 ? (
            // The label above carries the numbers; the bar is its picture.
            <span
              className={styles.meter}
              data-tone={share >= 0.9 ? 'danger' : share >= 0.7 ? 'caution' : undefined}
            >
              <span className={styles.meterTrack} aria-hidden="true">
                <span
                  className={styles.meterFill}
                  style={{ inlineSize: `${Math.round(share * 100)}%` } as CSSProperties}
                />
              </span>
            </span>
          ) : null}
        </li>
      </ul>

      {GROUPS.map((group) => (
        <section key={group} className="wp-stack" aria-labelledby={`int-group-${group}`}>
          <h3 id={`int-group-${group}`} className={styles.groupTitle}>
            {t(`groups.${group}`)}
          </h3>
          <div className={styles.intGrid}>
            {data.integrations
              .filter((i) => i.group === group)
              .map((view) => (
                <IntegrationCard key={view.id} view={view} name={name(view.id)} at={at} />
              ))}
          </div>
        </section>
      ))}
    </section>
  );
}
