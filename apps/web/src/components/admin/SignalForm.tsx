'use client';

import {
  Button,
  Notice,
  NumberField,
  SelectField,
  type SelectOption,
  TextField,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

const START = {
  title: '',
  summary: '',
  source: 'official',
  sourceName: '',
  sourceUrl: '',
  publishedOn: '',
  language: 'en',
  regions: '',
  sectors: '',
  importance: 2,
};

const words = (text: string) =>
  text
    .split(/[,\n]+/)
    .map((w) => w.trim())
    .filter(Boolean);

/**
 * Add a signal: something that changed, written by staff from a source they read. There is
 * no way to publish one without saying where it comes from, and nothing here writes it for
 * them.
 */
export function SignalForm({
  kinds,
  languages,
  latest,
  earliest,
}: {
  /** The kinds of source staff can choose from, already named. */
  kinds: SelectOption[];
  /** The languages a signal can be written in, by their own names. */
  languages: Array<{ id: string; label: string }>;
  /** The last and first day a signal may be dated (YYYY-MM-DD): today, and a year back. */
  latest: string;
  earliest: string;
}) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const dateId = useId();
  const [values, setValues] = useState(START);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const set = <K extends keyof typeof START>(key: K, value: (typeof START)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ready =
      values.title.trim().length >= 12 &&
      values.summary.trim().length >= 40 &&
      values.sourceName.trim().length >= 2 &&
      values.sourceUrl.trim().startsWith('https://') &&
      values.publishedOn >= earliest &&
      values.publishedOn <= latest &&
      Number.isInteger(values.importance) &&
      values.importance >= 1 &&
      values.importance <= 5;
    if (!ready) {
      setError({ title: t('sCheck') });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/signals', {
        json: {
          title: values.title.trim(),
          summary: values.summary.trim(),
          source: values.source,
          sourceName: values.sourceName.trim(),
          sourceUrl: values.sourceUrl.trim(),
          publishedOn: values.publishedOn,
          language: values.language,
          regions: values.regions.split(/[\s,]+/).filter(Boolean),
          sectors: words(values.sectors),
          importance: values.importance,
        },
      });
      toast({ title: t('sPublished'), tone: 'safe' }, 3000);
      setValues(START);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiProblem && err.code === 'withdrawn'
          ? { title: t('sWasWithdrawn') }
          : err instanceof ApiProblem && [400, 409, 422].includes(err.status)
            ? { title: t('sCheck'), detail: err.issues[0]?.message ?? err.message }
            : { title: errors(problemKey(err)) },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Notice title={t('sSourceNeeded')} />
      <TextField
        label={t('sTitle')}
        description={t('sTitleHint')}
        value={values.title}
        onChange={(v) => set('title', v)}
        isRequired
        maxLength={200}
      />
      <TextField
        label={t('sSummary')}
        description={t('sSummaryHint')}
        multiline
        rows={4}
        value={values.summary}
        onChange={(v) => set('summary', v)}
        isRequired
        maxLength={800}
      />
      <div className={styles.pair}>
        <TextField
          label={t('sSourceName')}
          value={values.sourceName}
          onChange={(v) => set('sourceName', v)}
          isRequired
          maxLength={120}
        />
        <SelectField
          label={t('sKind')}
          options={kinds}
          selectedKey={values.source}
          onSelectionChange={(key) => set('source', String(key))}
          isRequired
        />
      </div>
      <TextField
        label={t('sSourceUrl')}
        type="url"
        inputMode="url"
        value={values.sourceUrl}
        onChange={(v) => set('sourceUrl', v)}
        isRequired
        maxLength={500}
      />
      <div className={styles.pair}>
        <div className={styles.dateField}>
          <label htmlFor={dateId}>{t('sPublishedOn')}</label>
          <input
            id={dateId}
            type="date"
            required
            min={earliest}
            max={latest}
            value={values.publishedOn}
            onChange={(e) => set('publishedOn', e.target.value)}
          />
        </div>
        <SelectField
          label={t('fLanguage')}
          options={languages}
          selectedKey={values.language}
          onSelectionChange={(key) => set('language', String(key))}
          isRequired
        />
      </div>
      <TextField
        label={t('fRegions')}
        description={t('fRegionsHint')}
        optionalLabel={common('optional')}
        value={values.regions}
        onChange={(v) => set('regions', v)}
        maxLength={120}
      />
      <TextField
        label={t('sSectors')}
        description={t('sSectorsHint')}
        optionalLabel={common('optional')}
        value={values.sectors}
        onChange={(v) => set('sectors', v)}
        maxLength={200}
      />
      <NumberField
        label={t('sImportance')}
        description={t('sImportanceHint')}
        value={values.importance}
        onChange={(v) => set('importance', v)}
        minValue={1}
        maxValue={5}
        step={1}
        isRequired
      />
      {error ? (
        <Notice tone="danger" role="alert" title={error.title}>
          {error.detail}
        </Notice>
      ) : null}
      <div className="wp-row">
        <Button type="submit" variant="primary" isBusy={busy}>
          {t('sPublish')}
        </Button>
      </div>
    </form>
  );
}
