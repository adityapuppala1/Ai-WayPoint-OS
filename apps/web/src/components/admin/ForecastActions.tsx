'use client';

import {
  Button,
  Disclosure,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

type Outcome = 'yes' | 'no' | 'annulled';

/**
 * What staff can do with a published forecast: change its chance while it is open (every
 * chance it showed is kept and scored), and record how it turned out — once.
 */
export function ForecastActions({
  id,
  open,
  percent,
}: {
  id: string;
  /** Still before its date: the chance may change. */
  open: boolean;
  /** The chance it shows now, 1 to 99. */
  percent: number;
}) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [busy, setBusy] = useState<'chance' | 'judge' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState(percent);
  const [rationale, setRationale] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const send = async (kind: 'chance' | 'judge', json: unknown, done: string) => {
    setBusy(kind);
    setError(null);
    try {
      await api(`/api/admin/forecasts/${id}/${kind}`, { json });
      toast({ title: done, tone: 'safe' }, 3000);
      setRationale('');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiProblem && [400, 409, 422].includes(err.status)
          ? (err.issues[0]?.message ?? err.message)
          : errors(problemKey(err)),
      );
    } finally {
      setBusy(null);
    }
  };

  const chanceReady =
    Number.isFinite(next) && next >= 1 && next <= 99 && rationale.trim().length >= 12;
  const judgeReady =
    outcome !== null &&
    note.trim().length >= 8 &&
    (outcome === 'annulled' || sourceUrl.trim().startsWith('https://'));

  const saveChance = (e: FormEvent) => {
    e.preventDefault();
    if (chanceReady)
      void send(
        'chance',
        { probability: next / 100, rationale: rationale.trim() },
        t('aChanceSaved'),
      );
  };
  const record = (e: FormEvent) => {
    e.preventDefault();
    if (judgeReady)
      void send(
        'judge',
        { outcome, note: note.trim(), sourceUrl: sourceUrl.trim() || undefined },
        t('aRecorded'),
      );
  };

  return (
    <div className={styles.actions}>
      {open ? (
        <Disclosure title={t('aChance')} headingLevel={4}>
          <form className={styles.form} onSubmit={saveChance} noValidate>
            <NumberField
              label={t('fProbability')}
              description={t('fProbabilityHint')}
              value={next}
              onChange={setNext}
              minValue={1}
              maxValue={99}
              step={1}
              isRequired
            />
            <TextField
              label={t('fRationale')}
              multiline
              rows={2}
              value={rationale}
              onChange={setRationale}
              isRequired
              maxLength={1200}
            />
            <div className="wp-row">
              <Button
                type="submit"
                variant="secondary"
                isBusy={busy === 'chance'}
                isDisabled={!chanceReady || busy !== null}
              >
                {common('save')}
              </Button>
            </div>
          </form>
        </Disclosure>
      ) : null}
      <Disclosure title={t('aJudge')} headingLevel={4} defaultExpanded={!open}>
        <form className={styles.form} onSubmit={record} noValidate>
          <RadioGroup
            label={t('aOutcome')}
            value={outcome}
            onChange={(v) => setOutcome(v as Outcome)}
            isRequired
          >
            <Radio value="yes">{t('aHappened')}</Radio>
            <Radio value="no">{t('aDidNot')}</Radio>
            <Radio value="annulled">{t('aWithdraw')}</Radio>
          </RadioGroup>
          <TextField
            label={t('aNote')}
            multiline
            rows={2}
            value={note}
            onChange={setNote}
            isRequired
            maxLength={800}
          />
          <TextField
            label={t('aSourceUrl')}
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={setSourceUrl}
            isRequired={outcome !== 'annulled'}
            maxLength={500}
          />
          <p className={styles.note}>{t('aOnce')}</p>
          <div className="wp-row">
            <Button
              type="submit"
              variant="primary"
              isBusy={busy === 'judge'}
              isDisabled={!judgeReady || busy !== null}
            >
              {t('aRecord')}
            </Button>
          </div>
        </form>
      </Disclosure>
      {error ? <Notice tone="danger" role="alert" title={error} /> : null}
    </div>
  );
}
