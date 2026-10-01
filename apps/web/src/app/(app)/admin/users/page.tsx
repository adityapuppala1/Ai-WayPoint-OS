import { people } from '@waypoint/api';
import { isStaffRole } from '@waypoint/core/console';
import { EmptyState, Icon } from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import styles from '@/components/admin/admin.module.css';
import { requireConsole } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.people');
  return { title: t('accountsTitle'), robots: { index: false } };
}

type Query = Partial<Record<'q' | 'kind' | 'status' | 'country' | 'sort' | 'dir' | 'page', string>>;

/**
 * Accounts: search by name, address or number, filter by kind and state, sort by any column,
 * page through. A plain form and plain links, so it works before the page's script has run.
 */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const viewer = await requireConsole('users', '/admin/users');
  const raw = await searchParams;
  const query = people.AccountQuerySchema.safeParse(raw);
  const input = query.success ? query.data : people.AccountQuerySchema.parse({});
  const [t, format, list] = await Promise.all([
    getTranslations('admin.people'),
    getFormatter(),
    people.listAccounts(viewer.db, input),
  ]);

  const href = (change: Query) => {
    const next = new URLSearchParams();
    const merged = { ...raw, page: undefined, ...change };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return (s ? `/admin/users?${s}` : '/admin/users') as Route;
  };
  const sortLink = (sort: 'joined' | 'active' | 'name') => {
    const current = input.sort === sort;
    const dir = current && input.dir === 'desc' ? 'asc' : 'desc';
    return {
      href: href({ sort, dir }),
      ariaSort: current ? (input.dir === 'asc' ? 'ascending' : 'descending') : 'none',
    } as const;
  };
  const when = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const kinds = [
    ['accounts', list.counts.accounts],
    ['guests', list.counts.guests],
    ['staff', list.counts.staff],
    ['all', list.counts.accounts + list.counts.guests],
  ] as const;
  const states = [
    ['all', null],
    ['active', null],
    ['held', list.counts.held],
    ['unconfirmed', list.counts.unconfirmed],
  ] as const;

  return (
    <section className="wp-stack" aria-labelledby="accounts-title">
      <header className={styles.sectionHead}>
        <h2 id="accounts-title">{t('accountsTitle')}</h2>
        <p className="wp-lead">{t('accountsLead')}</p>
      </header>

      <search>
        <form className={styles.searchRow} action="/admin/users" method="get">
          <label className="wp-visually-hidden" htmlFor="account-q">
            {t('search')}
          </label>
          <input
            id="account-q"
            name="q"
            type="search"
            defaultValue={input.q ?? ''}
            placeholder={t('searchPlaceholder')}
            className={styles.searchInput}
            autoComplete="off"
          />
          {input.kind !== 'accounts' ? (
            <input type="hidden" name="kind" value={input.kind} />
          ) : null}
          {input.status !== 'all' ? (
            <input type="hidden" name="status" value={input.status} />
          ) : null}
          <button type="submit" className={styles.searchButton}>
            <Icon name="search" size={18} />
            {t('search')}
          </button>
        </form>
      </search>

      <div className={styles.filterGroups}>
        <ul className={styles.filters} aria-label={t('kindLabel')}>
          {kinds.map(([kind, n]) => (
            <li key={kind}>
              <Link href={href({ kind })} aria-current={input.kind === kind ? 'page' : undefined}>
                {t(`kinds.${kind}`)} <span className="wp-num">{format.number(n)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className={styles.filters} aria-label={t('statusLabel')}>
          {states.map(([status, n]) => (
            <li key={status}>
              <Link
                href={href({ status })}
                aria-current={input.status === status ? 'page' : undefined}
              >
                {t(`states.${status}`)}
                {n !== null ? <span className="wp-num">{format.number(n)}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="wp-meta" role="status">
        {t('found', { n: list.total })}
      </p>

      {list.items.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <caption className="wp-visually-hidden">{t('accountsTitle')}</caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={sortLink('name').ariaSort}>
                  <Link href={sortLink('name').href}>{t('cols.name')}</Link>
                </th>
                <th scope="col">{t('cols.kind')}</th>
                <th scope="col">{t('cols.place')}</th>
                <th scope="col" aria-sort={sortLink('joined').ariaSort}>
                  <Link href={sortLink('joined').href}>{t('cols.joined')}</Link>
                </th>
                <th scope="col" aria-sort={sortLink('active').ariaSort}>
                  <Link href={sortLink('active').href}>{t('cols.active')}</Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((a) => (
                <tr key={a.id} data-held={a.held || undefined}>
                  <th scope="row">
                    <Link href={`/admin/users/${a.id}` as Route} className={styles.rowLink}>
                      <span className={styles.rowName} dir="auto">
                        {a.isGuest ? t('guest') : a.name || t('noName')}
                      </span>
                      <span className="wp-meta">{a.email ?? a.phone ?? a.id}</span>
                    </Link>
                  </th>
                  <td>
                    <span className={styles.tagRow}>
                      {isStaffRole(a.role) ? (
                        <span className="wp-tag">{t(`roles.${a.role}`)}</span>
                      ) : null}
                      {a.held ? (
                        <span className={styles.statusPill} data-status="failing">
                          <Icon name="lock" size={14} />
                          {t('held')}
                        </span>
                      ) : null}
                      {!a.isGuest && !a.verified ? (
                        <span className={styles.statusPill} data-status="untested">
                          {t('unconfirmed')}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>{[a.country, a.locale].filter(Boolean).join(', ') || '—'}</td>
                  <td>{when(a.joinedAt)}</td>
                  <td>{when(a.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t('none')} />
      )}

      {list.pages > 1 ? (
        <nav className={styles.pager} aria-label={t('pages')}>
          {input.page > 1 ? (
            <Link href={href({ page: String(input.page - 1) })} rel="prev">
              {t('previous')}
            </Link>
          ) : (
            <span />
          )}
          <span className="wp-meta">{t('pageOf', { page: input.page, pages: list.pages })}</span>
          {input.page < list.pages ? (
            <Link href={href({ page: String(input.page + 1) })} rel="next">
              {t('next')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
