import type { RoleSuggestionView } from '@waypoint/api/client';
import { LinkButton } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { contentLang } from '@/components/EnglishContentNote';
import styles from './role.module.css';

type ReasonKey =
  | 'your-target'
  | 'strong-skill-match'
  | 'some-skill-match'
  | 'matches-interest'
  | 'reachable-in-horizon'
  | 'lower-ai-exposure';

/** A suggested role: why it fits, what is missing, and an honest note about AI. */
export async function RoleCard({ suggestion: s }: { suggestion: RoleSuggestionView }) {
  const t = await getTranslations('path');
  const reasons = await getTranslations('roleReasons');
  const exposure = await getTranslations('aiExposure');
  const format = await getFormatter();
  const lang = await contentLang();
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>
            <Link href={`/path/roles/${s.roleId}` as Route}>{s.title}</Link>
          </h3>
          <p className="wp-meta">{s.family}</p>
        </div>
        <p className={styles.fit}>
          <span className={styles.fitValue}>{format.number(s.fit, { style: 'percent' })}</span>
          <span className="wp-meta">{t('fit')}</span>
        </p>
      </div>
      <p className="wp-secondary" lang={lang}>
        {s.summary}
      </p>
      {s.reasons.length ? (
        <ul className={styles.reasons}>
          {s.reasons.map((r) => (
            <li key={r}>{reasons(r as ReasonKey)}</li>
          ))}
        </ul>
      ) : null}
      <dl className="wp-dl">
        <dt>{t('missing')}</dt>
        <dd>
          {s.missingSkills.length
            ? s.missingSkills.map((m) => m.name).join(', ')
            : t('noneMissing')}
        </dd>
        <dt>{exposure('label')}</dt>
        <dd>
          <span className={styles.exposure} data-level={s.aiExposure}>
            {exposure(s.aiExposure)}
          </span>
          <span className={styles.aiNote} lang={lang}>
            {s.aiNote}
          </span>
        </dd>
      </dl>
      <div className="wp-row">
        <LinkButton
          href={`/path/new?role=${s.roleId}` as Route}
          variant="secondary"
          size="sm"
          icon="forward"
        >
          {t('planForRole')}
        </LinkButton>
      </div>
    </article>
  );
}
