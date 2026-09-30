import { path } from '@waypoint/api';
import { getRole, roleTitle } from '@waypoint/content';
import { Icon, LinkButton, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnglishContentNote } from '@/components/EnglishContentNote';
import styles from '@/components/path/role.module.css';
import { requireViewer } from '@/lib/server';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: getRole(id) ? roleTitle(id, await getLocale()) : 'Role' };
}

export default async function RolePage({ params }: Props) {
  const { id } = await params;
  const viewer = await requireViewer(`/path/roles/${id}`);
  if (!getRole(id)) notFound();
  const skills = await path.getUserSkills(viewer.db, viewer.user.id);
  const locale = await getLocale();
  // Descriptions are English until people translate them; mark them so screen readers switch voice.
  const contentLang = locale === 'en' ? undefined : 'en';
  const role = path.roleDetail(id, {
    locale,
    skills,
    languages: viewer.profile.languages.length ? viewer.profile.languages : [viewer.profile.locale],
    country: viewer.profile.country,
    budget: viewer.profile.learningBudget,
  });
  const t = await getTranslations('path');
  const levels = await getTranslations('skillLevels');
  const exposure = await getTranslations('aiExposure');
  const common = await getTranslations('common');

  return (
    <div className="wp-page">
      <header className="wp-page-head">
        <p className="wp-meta">
          <Link href={'/path' as Route}>{t('title')}</Link>
        </p>
        <h1>{role.title}</h1>
        <p className="wp-meta">{role.family}</p>
        <p className="wp-lead" lang={contentLang}>
          {role.summary}
        </p>
        <EnglishContentNote />
        <div className="wp-row">
          <LinkButton href={`/path/new?role=${role.id}` as Route} variant="primary" icon="forward">
            {t('planForRole')}
          </LinkButton>
        </div>
      </header>

      <Panel title={exposure('label')}>
        <p className={styles.exposure} data-level={role.aiExposure}>
          {exposure(role.aiExposure)}
        </p>
        <p className="wp-secondary" lang={contentLang}>
          {role.aiNote}
        </p>
      </Panel>

      <Panel title={t('skillsNeeded')} flush>
        <ul className="wp-plain-list">
          {role.skills.map((s) => (
            <li key={s.id} className="wp-plain-row">
              <div>
                <p className="wp-strong">{s.name}</p>
                <p className="wp-secondary" lang={contentLang}>
                  {s.description}
                </p>
              </div>
              <p className="wp-meta">
                {t('yourLevel', { level: levels(String(s.yourLevel) as '1') })}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t('entryPaths')}>
        <ul className="wp-ol" lang={contentLang}>
          {role.entryPaths.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Panel>

      {role.resources.length ? (
        <Panel title={t('whereToLearn')} flush>
          <ul className="wp-plain-list">
            {role.resources.map((r) => (
              <li key={r.id} className="wp-plain-row">
                <div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="wp-strong">
                    {r.title}
                  </a>
                  <p className="wp-meta">{r.provider}</p>
                </div>
                <Icon name="external" size={16} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <p className="wp-meta">
        {common('sources')}:{' '}
        {role.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 ? ', ' : ''}
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
