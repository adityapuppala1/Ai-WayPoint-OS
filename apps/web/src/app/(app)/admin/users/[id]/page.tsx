import { people } from '@waypoint/api';
import { isStaffRole } from '@waypoint/core/console';
import { Icon, LinkButton, Panel } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AccountActions } from '@/components/admin/AccountActions';
import styles from '@/components/admin/admin.module.css';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.people');
  return { title: t('accountTitle'), robots: { index: false } };
}

/**
 * One account, as the platform holds it: never anything the person wrote for themselves.
 * Opening it is recorded in the activity log.
 */
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireConsole('users', `/admin/users/${id}`);
  if (!/^[\w-]{8,64}$/.test(id)) notFound();
  const detail = await people
    .accountDetail(viewer.db, { userId: viewer.user.id }, id)
    .catch(() => null);
  if (!detail) notFound();
  const [t, format] = await Promise.all([getTranslations('admin.people'), getFormatter()]);
  const a = detail.account;
  const when = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const self = id === viewer.user.id;

  const facts: Array<[string, string]> = [
    [
      t('facts.kind'),
      a.isGuest ? t('guest') : isStaffRole(a.role) ? t(`roles.${a.role}`) : t('roles.member'),
    ],
    [t('facts.address'), a.email ?? '—'],
    [t('facts.phone'), a.phone ?? '—'],
    [t('facts.confirmed'), a.isGuest ? '—' : a.verified ? t('yes') : t('no')],
    [t('facts.place'), [a.country, a.locale, a.timezone].filter(Boolean).join(', ') || '—'],
    [t('facts.situation'), a.situation ?? '—'],
    [t('facts.joined'), when(a.joinedAt)],
    [t('facts.active'), when(a.lastActiveAt)],
    [t('facts.plans'), format.number(detail.uses.plans)],
    [t('facts.organisations'), format.number(detail.uses.organisations)],
  ];

  return (
    <section className="wp-stack" aria-labelledby="account-title">
      <div className="wp-row">
        <LinkButton href={'/admin/users' as Route} variant="quiet" size="sm" icon="back">
          {t('accountsTitle')}
        </LinkButton>
      </div>
      <header className={styles.sectionHead}>
        <h2 id="account-title" dir="auto">
          {a.isGuest ? t('guest') : a.name || t('noName')}
        </h2>
        <p className="wp-meta">{t('privateNote')}</p>
      </header>

      {a.held ? (
        <p className={styles.intCheck} data-ok="false">
          <Icon name="lock" size={16} />
          <span>
            {a.heldUntil ? t('heldUntil', { until: when(a.heldUntil) }) : t('heldForGood')}
            {a.heldReason ? ` ${t('heldBecause', { reason: a.heldReason })}` : ''}
          </span>
        </p>
      ) : null}

      <Panel title={t('factsTitle')} headingLevel={3}>
        <dl className={styles.facts}>
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd dir="auto">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={t('devicesTitle')} description={t('devicesLead')} headingLevel={3}>
        {detail.sessions.length ? (
          <ul className={styles.rows}>
            {detail.sessions.map((s, i) => (
              <li key={i}>
                <span>{s.device}</span>
                <span className="wp-meta">{when(s.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-meta">{t('noDevices')}</p>
        )}
      </Panel>

      {self ? (
        <p className="wp-meta">{t('selfNote')}</p>
      ) : (
        <Panel title={t('actionsTitle')} description={t('actionsLead')} headingLevel={3}>
          <AccountActions
            id={id}
            held={a.held}
            isGuest={a.isGuest}
            isStaff={isStaffRole(a.role)}
            role={isStaffRole(a.role) ? a.role : 'member'}
            confirmWord={a.isGuest ? 'guest' : (a.email ?? '').toLowerCase()}
          />
        </Panel>
      )}

      <Panel title={t('historyTitle')} headingLevel={3}>
        {detail.history.length ? (
          <ul className={styles.rows}>
            {detail.history.map((h) => (
              <li key={`${h.action}-${h.at}`}>
                <span>
                  {t.has(`actions.${h.action}` as 'actions.user.view')
                    ? t(`actions.${h.action}` as 'actions.user.view')
                    : h.action}
                </span>
                <span className="wp-meta">
                  {h.by ? `${h.by}, ` : ''}
                  {when(h.at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wp-meta">{t('noHistory')}</p>
        )}
      </Panel>
    </section>
  );
}
