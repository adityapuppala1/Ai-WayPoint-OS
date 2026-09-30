/**
 * The frame for the public privacy notice and terms: who runs this Waypoint, the short version
 * (the page's one Sign), contents drawn as a route, and the sections themselves.
 */
import type { legal } from '@waypoint/api';
import { Icon, type IconName } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import styles from './legal.module.css';

type Facts = ReturnType<typeof legal.legalFacts>;

export interface LegalSection {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalDocument({
  title,
  lead,
  updated,
  who,
  shortTitle,
  short,
  contentsLabel,
  sections,
  foot,
}: {
  title: string;
  lead: string;
  updated: string;
  who: ReactNode;
  shortTitle: string;
  short: Array<{ icon: IconName; text: string }>;
  contentsLabel: string;
  sections: LegalSection[];
  foot: ReactNode;
}) {
  const stations = (
    <ol className={styles.stations}>
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`}>{s.title}</a>
        </li>
      ))}
    </ol>
  );
  return (
    <article className={styles.page} aria-labelledby="legal-title">
      <header className={styles.head}>
        <h1 id="legal-title">{title}</h1>
        <p className="wp-lead">{lead}</p>
        <p className="wp-meta">{updated}</p>
      </header>
      {who}
      <section className={styles.short} aria-labelledby="legal-short">
        <h2 id="legal-short">{shortTitle}</h2>
        <ul>
          {short.map((item) => (
            <li key={item.icon}>
              <Icon name={item.icon} size={22} weight="bold" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label={contentsLabel}>
          <details className={styles.tocSmall}>
            <summary>{contentsLabel}</summary>
            {stations}
          </details>
          <div className={styles.tocWide}>
            <p className={styles.tocTitle}>{contentsLabel}</p>
            {stations}
          </div>
        </nav>
        <div className={styles.body}>
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className={styles.section}
              aria-labelledby={`${s.id}-title`}
            >
              <h2 id={`${s.id}-title`}>{s.title}</h2>
              {s.children}
            </section>
          ))}
          <footer className={styles.foot}>{foot}</footer>
        </div>
      </div>
    </article>
  );
}

/** A plain bulleted list. */
export function Points({ items }: { items: Array<{ id: string; text: ReactNode }> }) {
  return (
    <ul className={styles.points}>
      {items.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  );
}

/** Pairs such as "what we collect → why", stacked on phones and side by side on wider screens. */
export function Rows({
  rows,
}: {
  rows: Array<{ id: string; term: ReactNode; detail: ReactNode }>;
}) {
  return (
    <dl className={styles.rows}>
      {rows.map((r) => (
        <div key={r.id} className={styles.row}>
          <dt>{r.term}</dt>
          <dd>{r.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

/** "Last updated 30 September 2026", in the reader's language. */
export async function updatedOn(isoDate: string): Promise<string> {
  const [t, format] = await Promise.all([getTranslations('legal'), getFormatter()]);
  const date = format.dateTime(new Date(`${isoDate}T00:00:00Z`), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return t('updated', { date });
}

/** Who runs this Waypoint and where its data is, or an honest note that it hasn't said. */
export async function WhoRuns({ facts }: { facts: Facts }) {
  const t = await getTranslations('legal');
  if (!facts.operator)
    return (
      <div className={styles.who}>
        <Icon name="info" size={22} />
        <p className="wp-secondary">{t('operatorMissing')}</p>
      </div>
    );
  return (
    <div className={styles.who}>
      <Icon name="org" size={22} />
      <div>
        <p>{t('operator', { operator: facts.operator })}</p>
        {facts.dataLocation ? (
          <p className="wp-secondary">{t('dataLocation', { place: facts.dataLocation })}</p>
        ) : null}
      </div>
    </div>
  );
}

export async function contactSection(facts: Facts): Promise<LegalSection> {
  const t = await getTranslations('legal');
  const email = facts.contactEmail;
  return {
    id: 'contact',
    title: t('contactTitle'),
    children: email ? (
      <p>
        {t.rich('contact', { email, link: (chunks) => <a href={`mailto:${email}`}>{chunks}</a> })}
      </p>
    ) : (
      <p>{t('contactMissing')}</p>
    ),
  };
}

/** Links to the other document, shown at the end of each. */
export async function LegalFoot({ current }: { current: 'privacy' | 'terms' }) {
  const t = await getTranslations('legal');
  return (
    <>
      {current === 'privacy' ? (
        <Link href={'/terms' as Route}>{t('termsLink')}</Link>
      ) : (
        <Link href={'/privacy' as Route}>{t('privacyLink')}</Link>
      )}
      <Link href={'/support' as Route}>{(await getTranslations('nav'))('support')}</Link>
    </>
  );
}
