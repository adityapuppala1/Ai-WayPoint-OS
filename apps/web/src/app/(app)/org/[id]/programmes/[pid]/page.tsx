import { ApiError, org } from '@waypoint/api';
import { localizeRole, ROLES } from '@waypoint/content';
import { isUuid } from '@waypoint/core';
import { getEnv } from '@waypoint/core/env';
import { Icon, ModuleMark, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { Insights } from '@/components/org/Insights';
import styles from '@/components/org/org.module.css';
import { ProgrammeActions } from '@/components/org/ProgrammeActions';
import { EditProgrammeButton } from '@/components/org/ProgrammeForm';
import { ProgrammeInvite } from '@/components/org/ProgrammeInvite';
import { QrCode } from '@/components/org/QrCode';
import { getViewer, requireViewer } from '@/lib/server';

type Props = { params: Promise<{ id: string; pid: string }> };

const load = cache(async (id: string, pid: string) => {
  if (!isUuid(id) || !isUuid(pid)) return null;
  const viewer = await getViewer();
  if (!viewer || viewer.user.isGuest) return null;
  try {
    return await org.programmeView(viewer.db, viewer.user.id, id, pid, await getLocale());
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, pid } = await params;
  const view = await load(id, pid);
  return { title: view?.programme.name ?? (await getTranslations('org'))('title') };
}

export default async function ProgrammePage({ params }: Props) {
  const { id, pid } = await params;
  const viewer = await requireViewer(`/org/${id}/programmes/${pid}`);
  if (viewer.user.isGuest) redirect('/org' as Route);
  const view = await load(id, pid);
  if (!view) notFound();
  const [t, format, locale] = await Promise.all([
    getTranslations('org'),
    getFormatter(),
    getLocale(),
  ]);
  const o = view.organisation;
  const p = view.programme;
  const joinUrl = `${getEnv().WAYPOINT_URL}${p.joinPath}`;
  const day = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00Z`), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const dates =
    p.startsOn && p.endsOn
      ? t('dateRange', { start: day(p.startsOn), end: day(p.endsOn) })
      : p.startsOn
        ? t('startsFrom', { date: day(p.startsOn) })
        : p.endsOn
          ? t('endsBy', { date: day(p.endsOn) })
          : null;
  const roles = ROLES.map((r) => localizeRole(r, locale)).map((r) => ({
    id: r.id,
    title: r.title,
    family: r.family,
  }));

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p>
          <Link href={`/org/${o.id}` as Route} className={styles.back}>
            <Icon name="back" size={16} />
            {t('backTo', { organisation: o.name })}
          </Link>
        </p>
        <div className="wp-row">
          <ModuleMark module="org" size="lg" />
          <h1 className={styles.pageTitle} dir="auto">
            {p.name}
          </h1>
        </div>
        <p className={styles.metaLine}>
          {p.archived ? <span className="wp-tag">{t('closed')}</span> : null}
          {dates ? <span>{dates}</span> : null}
          {p.targetRoles.map((r) => (
            <span key={r.id} className="wp-tag" data-tone="info">
              {r.title}
            </span>
          ))}
        </p>
        {p.description ? (
          <p className="wp-lead" dir="auto">
            {p.description}
          </p>
        ) : null}
      </header>

      {p.archived ? <Notice tone="caution" title={t('closedNotice')} /> : null}

      <Panel
        title={t('inviteTitle')}
        description={p.archived ? undefined : t('inviteProgrammeLead')}
        as="section"
        id="invite"
      >
        <ProgrammeInvite
          orgId={o.id}
          programmeId={p.id}
          programme={p.name}
          organisation={o.name}
          joinCode={p.joinCode}
          joinCodeDisplay={p.joinCodeDisplay}
          joinUrl={joinUrl}
          k={o.k}
          canManage={view.canManage}
          closed={p.archived}
          qr={<QrCode value={joinUrl} label={t('qrLabel')} className={styles.qr} />}
        />
      </Panel>

      <Panel title={t('insightsTitle')} description={t('insightsLead')} as="section" id="insights">
        <Insights insights={view.insights} hasTargets={p.targetRoles.length > 0} />
      </Panel>

      {view.canManage ? (
        <Panel title={t('settingsTitle')} as="section" tone="quiet">
          <div className="wp-row">
            <EditProgrammeButton
              orgId={o.id}
              programmeId={p.id}
              roles={roles}
              initial={{
                name: p.name,
                description: p.description ?? '',
                targetRoleIds: p.targetRoles.map((r) => r.id),
                startsOn: p.startsOn ?? '',
                endsOn: p.endsOn ?? '',
              }}
            />
            <ProgrammeActions
              orgId={o.id}
              programmeId={p.id}
              programme={p.name}
              closed={p.archived}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
