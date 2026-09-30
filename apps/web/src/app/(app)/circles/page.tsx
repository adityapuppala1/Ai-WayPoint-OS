import { circles as circlesService } from '@waypoint/api';
import { Icon, type IconName, LinkButton, ModuleMark, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CircleCard } from '@/components/circles/CircleCard';
import styles from '@/components/circles/circles.module.css';
import { EmptyNote } from '@/components/EmptyNote';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('circles');
  return { title: t('title'), description: t('lead') };
}

const PROMISES: Array<{ key: string; icon: IconName }> = [
  { key: 'safetySmall', icon: 'circles' },
  { key: 'safetyName', icon: 'account' },
  { key: 'safetyMasked', icon: 'hide' },
  { key: 'safetyScams', icon: 'shield' },
  { key: 'safetyPeers', icon: 'support' },
];

export default async function CirclesPage() {
  const viewer = await requireViewer('/circles');
  const [t, locale] = await Promise.all([getTranslations('circles'), getLocale()]);
  const view = await circlesService.circlesOverview(
    viewer.db,
    viewer.user.id,
    viewer.profile,
    viewer.consents,
    locale,
  );
  const guest = viewer.user.isGuest;
  // Where "pick one below" leads: the circles suggested for this person, or all of them.
  const firstList = view.suggested.length
    ? { id: 'circles-suggested', name: t('suggested') }
    : { id: 'circles-browse', name: t('browse') };
  const max = [...view.mine, ...view.suggested, ...view.browse][0]?.maxMembers ?? 12;

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <div className="wp-row">
          <ModuleMark module="circles" size="lg" />
          <h1>{t('title')}</h1>
        </div>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      {guest ? (
        <Notice
          title={t('guestTitle')}
          actions={
            <LinkButton
              href={`/sign-up?next=${encodeURIComponent('/circles')}` as Route}
              variant="primary"
              icon="account"
            >
              {t('guestAction')}
            </LinkButton>
          }
        >
          <p>{t('guestBody')}</p>
        </Notice>
      ) : (
        <section className="wp-section" aria-labelledby="circles-mine">
          <div className={styles.sectionHead}>
            <h2 id="circles-mine">{t('mine')}</h2>
          </div>
          {view.mine.length ? (
            <ul className={styles.cards}>
              {view.mine.map((c) => (
                <li key={c.id}>
                  <CircleCard circle={c} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote action={<a href={`#${firstList.id}`}>{firstList.name}</a>}>
              {t('mineEmpty')}
            </EmptyNote>
          )}
        </section>
      )}

      {view.suggested.length ? (
        <section className="wp-section" aria-labelledby="circles-suggested">
          <div className={styles.sectionHead}>
            <h2 id="circles-suggested">{t('suggested')}</h2>
            <p className={styles.hint}>{t('suggestedLead')}</p>
          </div>
          <ul className={styles.cards}>
            {view.suggested.map((c) => (
              <li key={c.id}>
                <CircleCard circle={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="wp-section" aria-labelledby="circles-browse">
        <div className={styles.sectionHead}>
          <h2 id="circles-browse">
            {view.suggested.length || view.mine.length ? t('browseMore') : t('browse')}
          </h2>
          {view.matching ? null : (
            <p className={styles.hint}>
              {t('suggestOff')}{' '}
              <Link href={'/settings/privacy' as Route}>{t('suggestOffLink')}</Link>
            </p>
          )}
        </div>
        {view.browse.length ? (
          <ul className={styles.cards}>
            {view.browse.map((c) => (
              <li key={c.id}>
                <CircleCard circle={c} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>{t('browseEmpty')}</p>
        )}
      </section>

      <Panel title={t('safetyTitle')} as="section" tone="quiet">
        <ul className={styles.promises}>
          {PROMISES.map((p) => (
            <li key={p.key}>
              <Icon name={p.icon} size={20} />
              <span>{t(p.key as 'safetySmall', { max })}</span>
            </li>
          ))}
        </ul>
        <p>
          <LinkButton href={'/support' as Route} variant="support" icon="support" size="sm">
            {t('getHelp')}
          </LinkButton>
        </p>
      </Panel>
    </div>
  );
}
