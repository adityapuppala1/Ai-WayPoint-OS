'use client';

import type { ShieldCheck } from '@waypoint/api/client';
import {
  Button,
  Checkbox,
  Dialog,
  Notice,
  NumberField,
  Panel,
  RiskMeter,
  SelectField,
  TextField,
  toast,
} from '@waypoint/ui';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { ApiProblem, api } from '@/lib/api';
import { ltr } from '@/lib/bidi';
import styles from './shield.module.css';

const CATEGORIES = [
  'job',
  'bank-kyc',
  'delivery',
  'investment',
  'crypto',
  'lottery-prize',
  'romance',
  'sextortion',
  'tech-support',
  'impersonation-authority',
  'digital-arrest',
  'loan-app',
  'utility-disconnection',
  'tax-refund',
  'government-scheme',
  'family-emergency',
  'marketplace',
  'rental',
  'charity',
  'phishing-link',
  'sim-swap-otp',
  'qr-code',
  'deepfake-voice',
  'other',
] as const;
type Category = (typeof CATEGORIES)[number];

interface Channel {
  country: string;
  name: string;
  phone?: string;
  url?: string;
  what: string;
  timeCritical?: boolean;
}

function ChannelList({ channels, urgentLabel }: { channels: Channel[]; urgentLabel: string }) {
  return (
    <ul className={styles.signs}>
      {channels.map((c) => (
        <li key={`${c.country}-${c.name}`}>
          <p className={styles.signTitle}>{c.name}</p>
          {c.timeCritical ? <p className={styles.urgent}>{urgentLabel}</p> : null}
          <p className="wp-secondary">{c.what}</p>
          <p className="wp-row">
            {c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{ltr(c.phone)}</a> : null}
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {c.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ShieldChecker({
  country,
  aiAvailable,
  aiConsented,
  channels,
  afterHigh,
}: {
  country: string | null;
  aiAvailable: boolean;
  aiConsented: boolean;
  channels: Channel[];
  /** Shown under a high or very high verdict: where else on Waypoint to go from here. */
  afterHigh?: ReactNode;
}) {
  const t = useTranslations('shield');
  const levels = useTranslations('riskLevels');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const locale = useLocale();
  const [text, setText] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<ShieldCheck | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<ShieldCheck>('/api/shield/check', {
        json: { text, country: country ?? undefined, locale, aiConsent: aiConsent || undefined },
      });
      setCheck(res);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof ApiProblem && err.status === 429 ? err.message : errors('generic'));
    } finally {
      setBusy(false);
    }
  };

  const verdict = check
    ? {
        low: t('verdictLow'),
        unclear: t('verdictUnclear'),
        high: t('verdictHigh'),
        'very-high': t('verdictVeryHigh'),
      }[check.result.level]
    : '';

  const aiLine = check
    ? check.ai.used
      ? check.result.engine.ai?.agreed
        ? t('aiAgreed')
        : t('aiRaised')
      : check.ai.reason === 'skipped-certain'
        ? t('aiSkipped')
        : null
    : null;

  return (
    <>
      <Panel as="section" aria-label={t('title')}>
        <form className={styles.form} onSubmit={run}>
          <TextField
            label={t('inputLabel')}
            multiline
            rows={5}
            placeholder={t('inputPlaceholder')}
            value={text}
            onChange={(v) => {
              setText(v);
              if (check) setCheck(null);
            }}
            maxLength={4000}
          />
          {aiAvailable && !aiConsented ? (
            <Checkbox
              isSelected={aiConsent}
              onChange={setAiConsent}
              description={t('aiConsentHint')}
            >
              {t('aiConsent')}
            </Checkbox>
          ) : null}
          <div className="wp-row">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon="shield"
              isBusy={busy}
              isDisabled={!text.trim()}
            >
              {busy ? t('checking') : t('check')}
            </Button>
            {check ? (
              <Button
                variant="quiet"
                onPress={() => {
                  setCheck(null);
                  setText('');
                }}
              >
                {t('clear')}
              </Button>
            ) : null}
          </div>
          {error ? <Notice tone="danger" role="alert" title={error} /> : null}
        </form>
      </Panel>

      {check ? (
        <section className={styles.result} aria-labelledby="shield-result">
          <h2 id="shield-result" ref={resultRef} tabIndex={-1} className={styles.resultTitle}>
            {t('resultTitle')}
          </h2>
          <RiskMeter
            level={check.result.level}
            verdict={verdict}
            scale={[levels('low'), levels('unclear'), levels('high'), levels('very-high')]}
          />
          {check.result.level === 'low' ? <p className="wp-secondary">{t('lowNote')}</p> : null}
          {check.seenBefore ? (
            <Notice tone="caution" title={t('seenBefore', { count: check.seenBefore })} />
          ) : null}

          {check.result.signals.length ? (
            <Panel title={t('signsTitle')} headingLevel={3}>
              <ul className={styles.signs}>
                {check.result.signals.map((s) => (
                  <li key={s.id}>
                    <p className={styles.signTitle}>{s.title}</p>
                    <p className="wp-secondary">{s.explanation}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <p className="wp-secondary">{t('noSigns')}</p>
          )}

          {check.result.urls.length ? (
            <Panel title={t('linksTitle')} headingLevel={3}>
              <ul className={styles.signs}>
                {check.result.urls.map((u) => (
                  <li key={u.url}>
                    <p className={styles.host}>{u.host}</p>
                    {u.lookalikeOf ? (
                      <p className={styles.danger}>
                        {t('linkLookalike', { brand: u.lookalikeOf })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title={t('whatToDo')} headingLevel={3}>
            <ol className={styles.advice}>
              {check.result.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </Panel>

          {check.result.report.length ? (
            <Panel title={t('reportTitle')} headingLevel={3}>
              <ChannelList channels={check.result.report} urgentLabel={t('reportTimeCritical')} />
            </Panel>
          ) : null}

          <div className="wp-row">
            {check.result.level !== 'low' ? (
              <Button variant="secondary" icon="flag" onPress={() => setReportOpen(true)}>
                {t('reportThis')}
              </Button>
            ) : null}
          </div>
          <p className="wp-meta">
            {aiLine ? `${aiLine} ` : ''}
            {t('engine', { version: check.result.engine.rules })}
          </p>
          {check.result.level === 'high' || check.result.level === 'very-high' ? afterHigh : null}
        </section>
      ) : null}

      {!check && channels.length ? (
        <Panel title={t('reportTitle')} as="section">
          <ChannelList channels={channels} urgentLabel={t('reportTimeCritical')} />
        </Panel>
      ) : null}

      <ReportDialog
        isOpen={reportOpen}
        onOpenChange={setReportOpen}
        country={country}
        initialCategory={(check?.result.categories[0] as Category | undefined) ?? 'other'}
        hosts={check ? [...new Set(check.result.urls.map((u) => u.host))].slice(0, 10) : []}
        closeLabel={common('close')}
      />
    </>
  );
}

function ReportDialog({
  isOpen,
  onOpenChange,
  country,
  initialCategory,
  hosts,
  closeLabel,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  country: string | null;
  initialCategory: Category;
  /** Websites found in the checked message: sent with the report so others can be warned. */
  hosts: string[];
  closeLabel: string;
}) {
  const t = useTranslations('shield');
  const errors = useTranslations('errors');
  const common = useTranslations('common');
  const [category, setCategory] = useState<Category>(initialCategory);
  const [description, setDescription] = useState('');
  const [identifiers, setIdentifiers] = useState('');
  const [amount, setAmount] = useState<number>(Number.NaN);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/shield/reports', {
        json: {
          category,
          description: description.trim() || undefined,
          country: country ?? undefined,
          identifiers: identifiers
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length >= 3)
            .slice(0, 10),
          amountLost: Number.isFinite(amount) ? amount : undefined,
          urls: hosts.length ? hosts : undefined,
        },
      });
      toast({ title: t('reportThanks'), tone: 'safe' });
      onOpenChange(false);
      setDescription('');
      setIdentifiers('');
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('reportFormTitle')}
      closeLabel={closeLabel}
    >
      <form className={styles.form} onSubmit={submit}>
        <p className="wp-secondary">{t('reportFormLead')}</p>
        {hosts.length ? (
          <p className="wp-secondary">{t('reportLinks', { hosts: hosts.join(', ') })}</p>
        ) : null}
        <SelectField
          label={t('category')}
          options={CATEGORIES.map((c) => ({
            id: c,
            label: t(`categories.${c}`),
            textValue: t(`categories.${c}`),
          }))}
          selectedKey={category}
          onSelectionChange={(k) => setCategory((k as Category) ?? 'other')}
        />
        <TextField
          label={t('description')}
          description={t('descriptionHint')}
          multiline
          rows={4}
          value={description}
          onChange={setDescription}
          maxLength={2000}
          optionalLabel={common('optional')}
        />
        <TextField
          label={t('identifiers')}
          description={t('identifiersHint')}
          multiline
          rows={3}
          value={identifiers}
          onChange={setIdentifiers}
          optionalLabel={common('optional')}
        />
        <NumberField
          label={t('amountLost')}
          minValue={0}
          value={amount}
          onChange={setAmount}
          optionalLabel={common('optional')}
        />
        <div className="wp-row">
          <Button type="submit" variant="primary" isBusy={busy}>
            {t('submitReport')}
          </Button>
          <Button variant="quiet" onPress={() => onOpenChange(false)}>
            {common('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
