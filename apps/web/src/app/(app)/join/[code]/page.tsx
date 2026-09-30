import { ApiError, org } from '@waypoint/api';
import { dbReady, getDb } from '@waypoint/db';
import { Icon, LinkButton, List, ModuleMark, Notice, Panel, Sign } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { JoinCodeForm } from '@/components/join/JoinCodeForm';
import { JoinProgramme } from '@/components/join/JoinProgramme';
import { LinkRow } from '@/components/LinkRow';
import styles from '@/components/org/org.module.css';
import { getViewer, pageRateLimit } from '@/lib/server';

type Props = { params: Promise<{ code: string }> };

const load = cache(async (code: string) => {
  // Room for a whole class joining from one school network; far too slow to guess codes.
  await pageRateLimit('join', 300, 600, `/join/${encodeURIComponent(code)}`);
  const viewer = await getViewer();
  await dbReady();
  try {
    return await org.joinPreview(
      viewer?.db ?? getDb(),
      viewer?.user.id ?? null,
      code,
      await getLocale(),
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const preview = await load((await params).code);
  const t = await getTranslations('join');
  return {
    title: preview?.programme.name ?? t('title'),
    description: preview ? t('runBy', { organisation: preview.organisation.name }) : t('lead'),
    robots: { index: false },
  };
}

export default async function JoinProgrammePage({ params }: Props) {
  const { code } = await params;
  const preview = await load(code);
  const [t, format, viewer] = await Promise.all([
    getTranslations('join'),
    getFormatter(),
    getViewer(),
  ]);

  if (!preview) {
    return (
      <div className="wp-page">
        <header className="wp-page-head">
          <div className="wp-row">
            <ModuleMark module="org" size="lg" />
            <h1>{t('title')}</h1>
          </div>
        </header>
        <Notice tone="caution" role="status" title={t('notFound')} />
        <Panel as="section">
          <JoinCodeForm initial={code} />
        </Panel>
      </div>
    );
  }
  // One address per programme: typed variants (lower case, with a dash) settle on the code.
  if (decodeURIComponent(code) !== preview.code) redirect(`/join/${preview.code}` as Route);

  const p = preview.programme;
  const organisation = preview.organisation.name;
  const day = (d: string) =>
    format.dateTime(new Date(`${d}T12:00:00Z`), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const details = [
    ...(p.startsOn ? [{ label: t('starts'), value: day(p.startsOn) }] : []),
    ...(p.endsOn ? [{ label: t('ends'), value: day(p.endsOn) }] : []),
  ];
  const onboarded = Boolean(viewer?.profile.onboardedAt);

  return (
    <div className="wp-page">
      <Sign
        eyebrow={preview.joined ? t('eyebrowJoined') : t('eyebrow')}
        title={<span dir="auto">{p.name}</span>}
        module="org"
        context={t('runBy', { organisation })}
        details={details}
        headingLevel={1}
      >
        {p.description ? <p dir="auto">{p.description}</p> : null}
      </Sign>

      {preview.joined ? (
        <Notice
          tone="safe"
          role="status"
          title={t('joinedTitle')}
          actions={
            <div className="wp-row">
              {onboarded ? (
                <LinkButton href={'/path' as Route} variant="primary" icon="forward">
                  {t('choosePath')}
                </LinkButton>
              ) : (
                <LinkButton href={'/start' as Route} variant="primary" icon="forward">
                  {t('setUp')}
                </LinkButton>
              )}
              <LinkButton
                href={'/settings/privacy#programmes' as Route}
                variant="quiet"
                icon="lock"
              >
                {t('manage')}
              </LinkButton>
            </div>
          }
        >
          <p>
            {t('joinedBody', { programme: p.name })}{' '}
            {preview.counted
              ? t(viewer?.user.isGuest ? 'countedGuest' : 'countedYes')
              : t('countedNo')}
          </p>
        </Notice>
      ) : preview.open ? (
        <Panel title={t('privacyTitle')} as="section">
          <div className="wp-stack">
            <ul className={styles.promiseList}>
              <li>
                <Icon name="show" size={20} className={styles.see} />
                <span>{t('privacySee', { organisation, k: preview.k })}</span>
              </li>
              <li>
                <Icon name="hide" size={20} className={styles.never} />
                <span>{t('privacyNever')}</span>
              </li>
              <li>
                <Icon name="signOut" size={20} />
                <span>{t('privacyLeave')}</span>
              </li>
            </ul>
            <JoinProgramme
              code={preview.code}
              organisation={organisation}
              signedIn={Boolean(viewer)}
              guest={!viewer || viewer.user.isGuest}
            />
          </div>
        </Panel>
      ) : (
        <Notice tone="caution" title={t('closedTitle')}>
          <p>{t('closedBody', { organisation })}</p>
        </Notice>
      )}

      {p.targetRoles.length ? (
        <Panel title={t('roles')} as="section" flush>
          <List>
            {p.targetRoles.map((r) => (
              <LinkRow
                key={r.id}
                href={`/path/roles/${r.id}`}
                leading={<ModuleMark module="path" size="sm" />}
                title={r.title}
              />
            ))}
          </List>
        </Panel>
      ) : null}
    </div>
  );
}
