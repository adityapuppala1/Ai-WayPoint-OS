'use client';

import {
  Button,
  Disclosure,
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

interface Words {
  question: string;
  description: string;
  whatToDo: string;
  resolutionCriteria: string;
}

const NO_WORDS: Words = { question: '', description: '', whatToDo: '', resolutionCriteria: '' };

const START = {
  ...NO_WORDS,
  category: 'jobs',
  regions: '',
  language: 'en',
  probability: Number.NaN,
  baseRate: Number.NaN,
  rationale: '',
  sources: '',
  resolvesOn: '',
};

const isQuestion = (q: string) => q.trim().length >= 12 && /[?؟]$/.test(q.trim());
const long = (v: string) => v.trim().length >= 12;
const chance = (v: number) => Number.isFinite(v) && v >= 1 && v <= 99;

/** "Name, https://…" on each line. A line without a full https:// address is left out. */
function parseSources(text: string): Array<{ name: string; url: string }> {
  return text
    .split('\n')
    .map((line) => {
      const at = line.indexOf('https://');
      if (at < 1) return null;
      const name = line.slice(0, at).replace(/[,\s]+$/, '');
      const url = line.slice(at).trim();
      return name.length >= 2 && url ? { name, url } : null;
    })
    .filter((s): s is { name: string; url: string } => s !== null);
}

/** Publish a forecast. The question, how it is judged and the date are fixed from then on. */
export function ForecastForm({
  categories,
  languages,
  earliest,
}: {
  categories: SelectOption[];
  /** The languages forecasts can be written in, by their own names. */
  languages: Array<{ id: string; label: string }>;
  /** The first day a forecast may be judged on (YYYY-MM-DD). */
  earliest: string;
}) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const dateId = useId();
  const [values, setValues] = useState(START);
  const [translations, setTranslations] = useState<Record<string, Words>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const set = <K extends keyof typeof START>(key: K, value: (typeof START)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setWords = (language: string, key: keyof Words, value: string) =>
    setTranslations((all) => ({
      ...all,
      [language]: { ...(all[language] ?? NO_WORDS), [key]: value },
    }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sources = parseSources(values.sources);
    const written = Object.entries(translations).filter(
      ([language, w]) => language !== values.language && w.question.trim(),
    );
    const ready =
      isQuestion(values.question) &&
      long(values.whatToDo) &&
      long(values.resolutionCriteria) &&
      long(values.rationale) &&
      chance(values.probability) &&
      (Number.isNaN(values.baseRate) || chance(values.baseRate)) &&
      sources.length > 0 &&
      sources.length === values.sources.split('\n').filter((l) => l.trim()).length &&
      values.resolvesOn >= earliest &&
      written.every(
        ([, w]) => isQuestion(w.question) && long(w.whatToDo) && long(w.resolutionCriteria),
      );
    if (!ready) {
      setError({ title: t('fCheck') });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/forecasts', {
        json: {
          question: values.question.trim(),
          description: values.description.trim(),
          whatToDo: values.whatToDo.trim(),
          resolutionCriteria: values.resolutionCriteria.trim(),
          category: values.category,
          regions: values.regions.split(/[\s,]+/).filter(Boolean),
          language: values.language,
          translations: Object.fromEntries(
            written.map(([language, w]) => [
              language,
              {
                question: w.question.trim(),
                description: w.description.trim() || undefined,
                whatToDo: w.whatToDo.trim(),
                resolutionCriteria: w.resolutionCriteria.trim(),
              },
            ]),
          ),
          probability: values.probability / 100,
          baseRate: Number.isNaN(values.baseRate) ? null : values.baseRate / 100,
          rationale: values.rationale.trim(),
          sources,
          resolvesOn: values.resolvesOn,
        },
      });
      toast({ title: t('fPublished'), tone: 'safe' }, 3000);
      setValues(START);
      setTranslations({});
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiProblem && (err.status === 422 || err.status === 400)
          ? { title: t('fCheck'), detail: err.issues[0]?.message ?? err.message }
          : { title: errors(problemKey(err)) },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Notice title={t('forecastFixed')} />
      <TextField
        label={t('fQuestion')}
        description={t('fQuestionHint')}
        value={values.question}
        onChange={(v) => set('question', v)}
        isRequired
        maxLength={240}
      />
      <TextField
        label={t('fDescription')}
        optionalLabel={common('optional')}
        multiline
        rows={3}
        value={values.description}
        onChange={(v) => set('description', v)}
        maxLength={1200}
      />
      <TextField
        label={t('fWhatToDo')}
        description={t('fWhatToDoHint')}
        multiline
        rows={3}
        value={values.whatToDo}
        onChange={(v) => set('whatToDo', v)}
        isRequired
        maxLength={800}
      />
      <TextField
        label={t('fCriteria')}
        description={t('fCriteriaHint')}
        multiline
        rows={3}
        value={values.resolutionCriteria}
        onChange={(v) => set('resolutionCriteria', v)}
        isRequired
        maxLength={800}
      />
      <div className={styles.pair}>
        <SelectField
          label={t('fCategory')}
          options={categories}
          selectedKey={values.category}
          onSelectionChange={(key) => set('category', String(key))}
          isRequired
        />
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
      <div className={styles.pair}>
        <NumberField
          label={t('fProbability')}
          description={t('fProbabilityHint')}
          value={values.probability}
          onChange={(v) => set('probability', v)}
          minValue={1}
          maxValue={99}
          step={1}
          isRequired
        />
        <NumberField
          label={t('fBaseRate')}
          optionalLabel={common('optional')}
          value={values.baseRate}
          onChange={(v) => set('baseRate', v)}
          minValue={1}
          maxValue={99}
          step={1}
        />
      </div>
      <TextField
        label={t('fRationale')}
        multiline
        rows={3}
        value={values.rationale}
        onChange={(v) => set('rationale', v)}
        isRequired
        maxLength={1200}
      />
      <TextField
        label={t('fSources')}
        description={t('fSourcesHint')}
        multiline
        rows={3}
        value={values.sources}
        onChange={(v) => set('sources', v)}
        isRequired
      />
      <div className={styles.dateField}>
        <label htmlFor={dateId}>{t('fResolvesOn')}</label>
        <input
          id={dateId}
          type="date"
          required
          min={earliest}
          value={values.resolvesOn}
          onChange={(e) => set('resolvesOn', e.target.value)}
        />
      </div>

      <div className={styles.translations}>
        <p className={styles.note}>{t('tHint')}</p>
        {languages
          .filter((l) => l.id !== values.language)
          .map((l) => {
            const w = translations[l.id] ?? NO_WORDS;
            return (
              <Disclosure key={l.id} title={t('tTitle', { language: l.label })} headingLevel={3}>
                <div className={styles.form} lang={l.id}>
                  <TextField
                    label={t('fQuestion')}
                    value={w.question}
                    onChange={(v) => setWords(l.id, 'question', v)}
                    maxLength={240}
                  />
                  <TextField
                    label={t('fDescription')}
                    multiline
                    rows={2}
                    value={w.description}
                    onChange={(v) => setWords(l.id, 'description', v)}
                    maxLength={1200}
                  />
                  <TextField
                    label={t('fWhatToDo')}
                    multiline
                    rows={2}
                    value={w.whatToDo}
                    onChange={(v) => setWords(l.id, 'whatToDo', v)}
                    maxLength={800}
                  />
                  <TextField
                    label={t('fCriteria')}
                    multiline
                    rows={2}
                    value={w.resolutionCriteria}
                    onChange={(v) => setWords(l.id, 'resolutionCriteria', v)}
                    maxLength={800}
                  />
                </div>
              </Disclosure>
            );
          })}
      </div>

      {error ? (
        <Notice tone="danger" role="alert" title={error.title}>
          {error.detail}
        </Notice>
      ) : null}
      <div className="wp-row">
        <Button type="submit" variant="primary" isBusy={busy}>
          {t('fPublish')}
        </Button>
      </div>
    </form>
  );
}
