import { ApiError, org } from '@waypoint/api';
import { COUNTRIES, localizeRole, ROLES } from '@waypoint/content';
import { isUuid } from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import { EmptyState, Icon, ModuleMark, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { OrgSettings } from '@/components/org/OrgSettings';
import styles from '@/components/org/org.module.css';
import { PrivacyPromise } from '@/components/org/PrivacyPromise';
import { NewProgrammeButton } from '@/components/org/ProgrammeForm';
import { TeamPanel } from '@/components/org/TeamPanel';
import { getViewer, requireViewer } from '@/lib/server';

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const viewer = await getViewer();
  if (!viewer || viewer.user.isGuest) return null;
  try {
    return await org.orgView(viewer.db, viewer.user.id, id, await getLocale());
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await load((await params).id);
  return { title: view?.organisation.name ?? (await getTranslations('org'))('title') };
}

export default async function OrganisationPage({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(`/org/${id}`);
  if (viewer.user.isGuest) redirect('/org' as Route);
  const view = await load(id);
  if (!view) notFound();
  const [t, format, locale] = await Promise.all([
    getTranslations('org'),
    getFormatter(),
    getLocale(),
  ]);
  const o = view.organisation;
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: names.of(c.code) ?? c.name })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );
  const roles = ROLES.map((r) => localizeRole(r, locale)).map((r) => ({
    id: r.id,
    title: r.title,
    family: r.family,
  }));
  const day = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const dates = (start: string | null, end: string | null) =>
    start && end
      ? t('dateRange', { start: day(start), end: day(end) })
      : start
        ? t('startsFrom', { date: day(start) })
        : end
          ? t('endsBy', { date: day(end) })
          : null;

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p>
          <Link href={'/org' as Route} className={styles.back}>
            <Icon name="back" size={16} />
            {t('allOrganisations')}
          </Link>
        </p>
        <div className="wp-row">
          <ModuleMark module="org" size="lg" />
          <h1 className={styles.pageTitle} dir="auto">
            {o.name}
          </h1>
        </div>
        <p className={styles.metaLine}>
          <span>{t(`kinds.${o.kind}`)}</span>
          {o.country ? <span>{names.of(o.country) ?? o.country}</span> : null}
          <span className="wp-tag" data-tone={view.role === 'member' ? undefined : 'info'}>
            {t(`roles.${view.role}`)}
          </span>
        </p>
      </header>

      <section className="wp-section" aria-labelledby="org-programmes">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="org-programmes">{t('programmesTitle')}</h2>
            <p className={styles.hint}>{t('programmesLead')}</p>
          </div>
          {view.canManage ? <NewProgrammeButton orgId={o.id} roles={roles} /> : null}
        </div>
        {view.programmes.length ? (
          <ul className={styles.cards}>
            {view.programmes.map((p) => (
              <li key={p.id} className={styles.card} data-closed={p.archived}>
                <div className={styles.cardBody}>
                  <p className={styles.cardTitle}>
                    <Link href={`/org/${o.id}/programmes/${p.id}` as Route} dir="auto">
                      {p.name}
                    </Link>
                  </p>
                  <p className={styles.metaLine}>
                    {p.archived ? <span className="wp-tag">{t('closed')}</span> : null}
                    {dates(p.startsOn, p.endsOn) ? (
                      <span>{dates(p.startsOn, p.endsOn)}</span>
                    ) : null}
                    <span>
                      {t('joinCode')}: <span className={styles.code}>{p.joinCodeDisplay}</span>
                    </span>
                  </p>
                </div>
                <div className={styles.cardAside}>
                  <span className={styles.count} data-hidden={p.participants.value === null}>
                    {p.participants.value === null
                      ? t('participantsFew', { k: p.participants.k })
                      : t('participantsAbout', { count: format.number(p.participants.value) })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Panel>
            <EmptyState title={t('programmesEmptyTitle')}>{t('programmesEmpty')}</EmptyState>
          </Panel>
        )}
      </section>

      <Panel title={t('teamTitle')} description={t('teamLead')} as="section" id="team">
        <TeamPanel
          orgId={o.id}
          organisation={o.name}
          myRole={view.role}
          canManage={view.canManage}
          canInvite={view.viewerVerified}
          members={view.members}
          invitations={view.invitations}
          baseUrl={getEnv().WAYPOINT_URL}
        />
      </Panel>

      {view.canManage ? (
        <OrgSettings organisation={o} isOwner={view.role === 'owner'} countries={countries} />
      ) : null}

      <PrivacyPromise k={o.k} />
    </div>
  );
}
