import { money } from '@waypoint/api';
import { COUNTRIES, getCountry } from '@waypoint/content';
import {
  Disclosure,
  Icon,
  LinkButton,
  Notice,
  PageHeader,
  Panel,
  type RiskLevel,
  RiskMeter,
  Stat,
} from '@waypoint/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ClearMoney } from '@/components/money/ClearMoney';
import { MoneyForm } from '@/components/money/MoneyForm';
import styles from '@/components/money/money.module.css';
import { RunwayTrack } from '@/components/money/RunwayTrack';
import { RunwayValue } from '@/components/money/RunwayValue';
import { NextStops } from '@/components/NextStops';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('money');
  return { title: t('title'), description: t('lead') };
}

/** Money pressure mapped onto the shared four-step meter (words carry the meaning, not colour). */
const METER: Record<'stable' | 'watch' | 'tight' | 'critical', RiskLevel> = {
  stable: 'low',
  watch: 'unclear',
  tight: 'high',
  critical: 'very-high',
};

const SUGGESTION_IDS = [
  'protect-essentials',
  'talk-to-lenders',
  'avoid-high-cost-credit',
  'check-benefits',
  'trim-other',
  'income-step',
  'emergency-buffer',
  'grow-buffer',
  'reduce-debt',
  'invest-in-skills',
  'free-advice',
] as const;
type SuggestionId = (typeof SUGGESTION_IDS)[number];
const isSuggestion = (id: string): id is SuggestionId =>
  (SUGGESTION_IDS as readonly string[]).includes(id);

export default async function MoneyPage() {
  const viewer = await requireViewer('/money');
  const [t, locale, format] = await Promise.all([
    getTranslations('money'),
    getLocale(),
    getFormatter(),
  ]);
  const view = await money.getMoney(viewer.db, viewer.user.id);

  const defaultCurrency =
    view.input?.currency ?? getCountry(viewer.profile.country)?.currency ?? 'USD';
  const names = new Intl.DisplayNames([locale, 'en'], { type: 'currency' });
  const codes = new Set([
    ...COUNTRIES.map((c) => c.currency),
    'USD',
    'EUR',
    'GBP',
    defaultCurrency,
  ]);
  const currencies = [...codes]
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const r = view.result;
  const currency = view.input?.currency ?? defaultCurrency;
  const amount = (n: number) =>
    format.number(n, { style: 'currency', currency, maximumFractionDigits: 0 });

  const header = <PageHeader module="money" title={t('title')} lead={t('lead')} />;

  if (!r || !view.input) {
    return (
      <div className="wp-page">
        {header}
        <Panel title={t('introTitle')} description={t('introBody')}>
          <MoneyForm initial={null} defaultCurrency={defaultCurrency} currencies={currencies} />
        </Panel>
        <p className="wp-meta">{t('disclaimer')}</p>
      </div>
    );
  }

  const runwayText =
    r.monthsOfRunway === null
      ? t('runwayNone')
      : r.monthsOfRunway < 1
        ? t('runwayLessThanMonth')
        : t('runwayMonths', { months: r.monthsOfRunway });
  const irregular = view.input.income.mode === 'irregular';
  const stressed = r.stress === 'tight' || r.stress === 'critical';

  return (
    <div className="wp-page wp-page-wide">
      {header}

      <div className="wp-split">
        <div className="wp-split-main">
          <Panel title={t('resultTitle')} as="section">
            <RiskMeter
              level={METER[r.stress]}
              verdict={t(`stress.${r.stress}.title`)}
              scale={[
                t('stress.stable.label'),
                t('stress.watch.label'),
                t('stress.tight.label'),
                t('stress.critical.label'),
              ]}
            />
            <p>{t(`stress.${r.stress}.body`)}</p>
            {view.updatedAt ? (
              <p className="wp-meta">
                {t('updatedOn', {
                  date: format.dateTime(new Date(view.updatedAt), { dateStyle: 'medium' }),
                })}
              </p>
            ) : null}
          </Panel>

          <Panel title={t('runwayTitle')} as="section">
            <div className={styles.runway}>
              <p className={styles.runwayValue}>
                {r.monthsOfRunway !== null && r.monthsOfRunway >= 1 ? (
                  <RunwayValue months={r.monthsOfRunway} />
                ) : (
                  runwayText
                )}
              </p>
              <RunwayTrack
                months={r.monthsOfRunway}
                stress={r.stress}
                axisLabel={(m) => t('runwayAxis', { months: m })}
              />
              {r.monthsOfRunway === null ? <p>{t('runwayNoneBody')}</p> : null}
            </div>
            <div className={styles.stats}>
              <Stat
                value={amount(r.monthlyIncome)}
                label={irregular ? t('statIncome') : t('statIncomeRegular')}
              />
              <Stat value={amount(r.outgoingsMonthly)} label={t('statOut')} />
              <Stat
                value={amount(Math.abs(r.monthlyGap))}
                label={r.monthlyGap >= 0 ? t('statGap') : t('statShort')}
              />
              {r.essentialsCoverMonths !== null ? (
                <Stat
                  value={t('statEssentialsValue', { months: r.essentialsCoverMonths })}
                  label={t('statEssentials')}
                />
              ) : null}
              {r.debtToIncome !== null && view.input.debt > 0 ? (
                <Stat value={t('statDebtValue', { share: r.debtToIncome })} label={t('statDebt')} />
              ) : null}
            </div>
          </Panel>

          {stressed ? (
            <Notice tone="support" title={t('overwhelmed')}>
              <Link href={'/support' as Route}>{t('overwhelmedLink')}</Link>
            </Notice>
          ) : null}

          <Panel title={t('nextTitle')} as="section">
            <ol className={styles.next}>
              {r.suggestions.map((s) => (
                <li key={s.id}>
                  <div>
                    <p className={styles.nextTitle}>
                      {isSuggestion(s.id) ? t(`suggestions.${s.id}.title`) : s.title}
                    </p>
                    <p className="wp-secondary">
                      {isSuggestion(s.id) ? t(`suggestions.${s.id}.detail`) : s.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel as="section">
            <Disclosure title={t('edit')} headingLevel={2}>
              <MoneyForm
                initial={view.input}
                defaultCurrency={defaultCurrency}
                currencies={currencies}
                submitLabel={t('edit')}
              />
            </Disclosure>
            <div>
              <ClearMoney />
            </div>
          </Panel>
        </div>

        {/* What goes with the numbers: keeping money safe, and where to go next. */}
        <div className="wp-split-aside">
          <Panel title={t('safetyTitle')} as="section">
            <ul className={styles.safety}>
              {(['safety1', 'safety2', 'safety3', 'safety4'] as const).map((k) => (
                <li key={k}>
                  <Icon name="safe" size={18} weight="fill" />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
            <div>
              <LinkButton href={'/shield' as Route} icon="shield">
                {t('safetyCheck')}
              </LinkButton>
            </div>
          </Panel>

          {/* Under pressure: the support you may be entitled to, and a way to more income. */}
          {stressed ? <NextStops stops={['civic', 'path']} /> : null}
        </div>
      </div>

      <p className="wp-meta">
        {t('privacy')} {t('disclaimer')}
      </p>
    </div>
  );
}
