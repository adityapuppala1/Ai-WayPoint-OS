import { ApiError, circles as circlesService } from '@waypoint/api';
import { Icon, LinkButton, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { CircleMenu } from '@/components/circles/CircleMenu';
import styles from '@/components/circles/circles.module.css';
import { JoinCircle } from '@/components/circles/JoinCircle';
import { Post } from '@/components/circles/Post';
import { PostComposer } from '@/components/circles/PostComposer';
import { SeatRing } from '@/components/circles/SeatRing';
import { requireViewer } from '@/lib/server';

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const viewer = await requireViewer(`/circles/${id}`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  try {
    return { viewer, view: await circlesService.circleView(viewer.db, viewer.user.id, id) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view } = await load((await params).id);
  return { title: view.circle.name };
}

const GUIDELINES = [
  'guideKind',
  'guidePrivate',
  'guideNoSelling',
  'guideExperience',
  'guideWorried',
] as const;

export default async function CirclePage({ params }: Props) {
  const { id } = await params;
  const { viewer, view } = await load(id);
  const [t, format, locale] = await Promise.all([
    getTranslations('circles'),
    getFormatter(),
    getLocale(),
  ]);
  const c = view.circle;
  const me = view.membership;
  const memberLabel = t('member', {
    number: String(me?.number ?? view.yourNumber),
  });
  const left = Math.max(0, c.maxMembers - c.memberCount);
  const moderator = me?.role === 'host' || me?.role === 'moderator';

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p>
          <Link href={'/circles' as Route} className={styles.back}>
            <Icon name="back" size={16} />
            {t('allCircles')}
          </Link>
        </p>
        <div className={styles.circleHead}>
          <SeatRing
            members={c.memberCount}
            max={c.maxMembers}
            count={format.number(c.memberCount)}
            size="lg"
          />
          <h1 lang={c.language}>{c.name}</h1>
        </div>
        <p className="wp-lead" lang={c.language}>
          {c.description}
        </p>
        <p className={styles.meta}>
          <span>{t('memberCount', { count: c.memberCount })}</span>
          {me ? null : c.full ? (
            <span className={styles.full}>{t('fullNote')}</span>
          ) : (
            <span>{t('placesLeft', { count: left })}</span>
          )}
          {c.language !== locale ? (
            <span className="wp-tag">
              {t('inLanguage', { language: format.displayName(c.language, { type: 'language' }) })}
            </span>
          ) : null}
        </p>
      </header>

      {me ? (
        <>
          <div className={styles.membership}>
            <p>
              <Icon name="account" size={18} />
              <span dir="auto">{t('youAppearAs', { name: me.name ?? memberLabel })}</span>
              {me.muted ? <span className="wp-tag">{t('mutedNote')}</span> : null}
            </p>
            <CircleMenu circleId={c.id} name={me.name} memberLabel={memberLabel} muted={me.muted} />
          </div>

          <Panel title={t('composerTitle')} as="section">
            <PostComposer circleId={c.id} />
          </Panel>

          <section className="wp-section" aria-labelledby="circle-feed">
            <div className={styles.sectionHead}>
              <h2 id="circle-feed">{t('feedTitle')}</h2>
            </div>
            {view.posts.length ? (
              <ol className={styles.feed}>
                {view.posts.map((p) => (
                  <li key={p.id}>
                    <Post post={p} circleId={c.id} moderator={moderator} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.hint}>{t('feedEmpty')}</p>
            )}
          </section>
        </>
      ) : (
        <Panel title={t('joinTitle')} description={t('joinLead')} as="section">
          <div className="wp-stack">
            <h3 className={styles.subhead}>{t('guidelinesTitle')}</h3>
            <ol className={styles.guidelines}>
              {GUIDELINES.map((g) => (
                <li key={g}>{t(g)}</li>
              ))}
            </ol>
            {viewer.user.isGuest ? (
              <Notice
                title={t('guestTitle')}
                actions={
                  <LinkButton
                    href={`/sign-up?next=${encodeURIComponent(`/circles/${c.id}`)}` as Route}
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
              <JoinCircle circleId={c.id} memberLabel={memberLabel} />
            )}
          </div>
        </Panel>
      )}

      <p className={styles.note}>
        <Icon name="support" size={16} />
        <span>
          {t('dangerNote')} <Link href={'/support' as Route}>{t('getHelp')}</Link>
        </span>
      </p>
    </div>
  );
}
