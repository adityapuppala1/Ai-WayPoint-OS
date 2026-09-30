import { org } from '@waypoint/api';
import { COUNTRIES } from '@waypoint/content';
import { LinkButton, ModuleMark, Notice, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { CreateOrgForm } from '@/components/org/CreateOrgForm';
import { InvitationAnswer } from '@/components/org/InvitationAnswer';
import styles from '@/components/org/org.module.css';
import { PrivacyPromise } from '@/components/org/PrivacyPromise';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('org');
  return { title: t('title'), description: t('lead') };
}

export default async function OrganisationsPage() {
  const viewer = await requireViewer('/org');
  const [t, format, locale] = await Promise.all([
    getTranslations('org'),
    getFormatter(),
    getLocale(),
  ]);
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const countryName = (code: string | null) => (code ? (names.of(code) ?? code) : null);

  const header = (
    <header className="wp-page-head">
      <div className="wp-row">
        <ModuleMark module="org" size="lg" />
        <h1>{t('title')}</h1>
      </div>
      <p className="wp-lead">{t('lead')}</p>
    </header>
  );

  if (viewer.user.isGuest) {
    return (
      <div className="wp-page">
        {header}
        <Notice
          title={t('guestTitle')}
          actions={
            <LinkButton
              href={`/sign-up?next=${encodeURIComponent('/org')}` as Route}
              variant="primary"
              icon="account"
            >
              {t('guestAction')}
            </LinkButton>
          }
        >
          <p>{t('guestBody')}</p>
        </Notice>
        <PrivacyPromise k={org.platformK()} />
      </div>
    );
  }

  const home = await org.orgHome(viewer.db, viewer.user.id, viewer.user.email);
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: names.of(c.code) ?? c.name })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );

  return (
    <div className="wp-page">
      {header}

      {home.invitations.length ? (
        <Panel title={t('invitationsTitle')} as="section">
          <ul className={styles.rows}>
            {home.invitations.map((i) => (
              <li key={i.id}>
                <p>
                  {t('invitationFrom', { inviter: i.inviter, organisation: i.organisation })}{' '}
                  <span className="wp-tag" data-tone="info">
                    {t(`roles.${i.role}`)}
                  </span>
                </p>
                <p className="wp-meta">
                  {t('invitationExpires', {
                    date: format.dateTime(new Date(i.expiresAt), { day: 'numeric', month: 'long' }),
                  })}
                </p>
                <InvitationAnswer invitationId={i.id} organisation={i.organisation} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section className="wp-section" aria-labelledby="orgs-mine">
        <div className={styles.sectionHead}>
          <h2 id="orgs-mine">{t('mineTitle')}</h2>
        </div>
        {home.organisations.length ? (
          <ul className={styles.cards}>
            {home.organisations.map((o) => (
              <li key={o.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <p className={styles.cardTitle}>
                    <Link href={`/org/${o.id}` as Route} dir="auto">
                      {o.name}
                    </Link>
                  </p>
                  <p className={styles.metaLine}>
                    <span>{t(`kinds.${o.kind}`)}</span>
                    {o.country ? <span>{countryName(o.country)}</span> : null}
                    <span>{t('programmeCount', { count: o.programmes })}</span>
                  </p>
                </div>
                <div className={styles.cardAside}>
                  <span className="wp-tag" data-tone={o.role === 'member' ? undefined : 'info'}>
                    {t(`roles.${o.role}`)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>{t('mineEmpty')}</p>
        )}
      </section>

      <Panel title={t('createTitle')} description={t('createLead')} as="section" id="create">
        {home.canCreate ? (
          <CreateOrgForm countries={countries} defaultCountry={viewer.profile.country} />
        ) : (
          <Notice tone="caution" title={t('limitReached', { limit: org.ORG_LIMIT })} />
        )}
      </Panel>

      <PrivacyPromise k={home.platformK} />
    </div>
  );
}
