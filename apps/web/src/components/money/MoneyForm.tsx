'use client';

import type { MoneyInput } from '@waypoint/api/client';
import { Button, NumberField, Radio, RadioGroup, SelectField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import styles from './money.module.css';

const ESSENTIALS = [
  'housing',
  'food',
  'utilities',
  'transport',
  'health',
  'phone',
  'childcare',
  'other',
] as const;
type Essential = (typeof ESSENTIALS)[number];
type Mode = MoneyInput['income']['mode'];
type Period = NonNullable<MoneyInput['income']['period']>;

/** NumberField gives NaN when cleared; the API wants a number or nothing. */
const num = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : undefined);

export function MoneyForm({
  initial,
  defaultCurrency,
  currencies,
  submitLabel,
}: {
  initial: MoneyInput | null;
  defaultCurrency: string;
  currencies: Array<{ code: string; name: string }>;
  submitLabel?: string;
}) {
  const t = useTranslations('money');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();

  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [mode, setMode] = useState<Mode>(initial?.income.mode ?? 'regular');
  const [amount, setAmount] = useState<number | undefined>(initial?.income.amount);
  const [period, setPeriod] = useState<Period>(initial?.income.period ?? 'month');
  const [months, setMonths] = useState<Array<number | undefined>>(
    initial?.income.months?.length ? initial.income.months : [undefined, undefined, undefined],
  );
  const [essentials, setEssentials] = useState<Partial<Record<Essential, number>>>(
    initial?.essentials ?? {},
  );
  const [other, setOther] = useState<number | undefined>(initial?.other);
  const [debt, setDebt] = useState<number | undefined>(initial?.debt);
  const [savings, setSavings] = useState<number | undefined>(initial?.savings);
  const [busy, setBusy] = useState(false);

  const money = useMemo(
    () =>
      ({
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }) as const,
    [currency],
  );
  const essentialsTotal = ESSENTIALS.reduce((s, k) => s + (num(essentials[k]) ?? 0), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const cleanEssentials: Partial<Record<Essential, number>> = {};
    for (const k of ESSENTIALS) {
      const v = num(essentials[k]);
      if (v !== undefined && v > 0) cleanEssentials[k] = v;
    }
    const body: MoneyInput = {
      currency,
      income:
        mode === 'regular'
          ? { mode, amount: num(amount) ?? 0, period }
          : mode === 'irregular'
            ? { mode, months: months.map(num).filter((v): v is number => v !== undefined) }
            : { mode },
      essentials: cleanEssentials,
      other: num(other) ?? 0,
      debt: num(debt) ?? 0,
      savings: num(savings) ?? 0,
    };
    try {
      await api('/api/money', { method: 'PUT', json: body });
      toast({ title: t('saved'), tone: 'safe' }, 2500);
      router.refresh();
      // Bring the result into view; the page re-renders with it at the top.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <SelectField
        label={t('currency')}
        options={currencies.map((c) => ({
          id: c.code,
          label: `${c.name} (${c.code})`,
          textValue: `${c.name} ${c.code}`,
        }))}
        selectedKey={currency}
        onSelectionChange={(k) => k && setCurrency(String(k))}
      />

      <fieldset className={styles.group}>
        <legend>{t('incomeTitle')}</legend>
        <RadioGroup label={t('incomeMode')} value={mode} onChange={(v) => setMode(v as Mode)}>
          <Radio value="regular">{t('incomeRegular')}</Radio>
          <Radio value="irregular" description={t('incomeMonthsHint')}>
            {t('incomeIrregular')}
          </Radio>
          <Radio value="none">{t('incomeNone')}</Radio>
        </RadioGroup>
        {mode === 'regular' ? (
          <div className={styles.grid}>
            <NumberField
              label={t('incomeAmount')}
              value={amount ?? Number.NaN}
              onChange={setAmount}
              minValue={0}
              formatOptions={money}
            />
            <SelectField
              label={t('incomePeriod')}
              options={(['week', 'fortnight', 'month'] as const).map((p) => ({
                id: p,
                label: t(`period.${p}`),
                textValue: t(`period.${p}`),
              }))}
              selectedKey={period}
              onSelectionChange={(k) => k && setPeriod(String(k) as Period)}
            />
          </div>
        ) : null}
        {mode === 'irregular' ? (
          <>
            <p className={styles.hint}>{t('incomeMonths')}</p>
            <div className={styles.grid}>
              {months.map((v, i) => (
                <NumberField
                  key={i}
                  label={t('incomeMonth', { count: i + 1 })}
                  value={v ?? Number.NaN}
                  onChange={(n) => setMonths((all) => all.map((x, j) => (j === i ? n : x)))}
                  minValue={0}
                  formatOptions={money}
                />
              ))}
            </div>
            {months.length < 6 ? (
              <div>
                <Button
                  variant="quiet"
                  icon="add"
                  onPress={() => setMonths((all) => [...all, undefined])}
                >
                  {t('addMonth')}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('essentialsTitle')}</legend>
        <p className={styles.hint}>{t('essentialsHint')}</p>
        <div className={styles.grid}>
          {ESSENTIALS.map((k) => (
            <NumberField
              key={k}
              label={t(`essential.${k}`)}
              value={essentials[k] ?? Number.NaN}
              onChange={(n) => setEssentials((all) => ({ ...all, [k]: num(n) }))}
              minValue={0}
              formatOptions={money}
              optionalLabel={common('optional')}
            />
          ))}
        </div>
        <p className={styles.total} aria-live="polite">
          {t('total', { amount: format.number(essentialsTotal, money) })}
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('restTitle')}</legend>
        <div className={styles.grid}>
          <NumberField
            label={t('otherTitle')}
            description={t('otherHint')}
            value={other ?? Number.NaN}
            onChange={setOther}
            minValue={0}
            formatOptions={money}
          />
          <NumberField
            label={t('debt')}
            description={t('debtHint')}
            value={debt ?? Number.NaN}
            onChange={setDebt}
            minValue={0}
            formatOptions={money}
          />
          <NumberField
            label={t('savings')}
            description={t('savingsHint')}
            value={savings ?? Number.NaN}
            onChange={setSavings}
            minValue={0}
            formatOptions={money}
          />
        </div>
      </fieldset>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon="forward" isBusy={busy}>
          {busy ? t('saving') : (submitLabel ?? t('save'))}
        </Button>
      </div>
      <p className={styles.hint}>{t('privacy')}</p>
    </form>
  );
}
