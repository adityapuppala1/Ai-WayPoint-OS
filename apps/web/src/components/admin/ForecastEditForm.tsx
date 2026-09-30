'use client';

import { Button, Disclosure, Notice, NumberField, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

interface Words {
  question: string;
  description: string;
  whatToDo: string;
  resolutionCriteria: string;
}

const NO_WORDS: Words = { question: '', description: '', whatToDo: '', resolutionCriteria: '' };

type Translation = {
  question: string;
  description?: string;
  whatToDo: string;
  resolutionCriteria: string;
};

export interface EditableForecast {
  id: string;
  language: string;
  question: string;
  description: string;
  whatToDo: string;
  resolutionCriteria: string;
  regions: string[];
  sources: Array<{ name: string; url: string }>;
  /** 0.01 to 0.99, or null when staff gave none. */
  baseRate: number | null;
  translations: Record<string, Translation>;
}

const isQuestion = (q: string) => q.trim().length >= 12 && /[?؟]$/.test(q.trim());
const long = (v: string) => v.trim().length >= 12;
const chance = (v: number) => Number.isFinite(v) && v >= 1 && v <= 99;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The same words in the same languages, whatever order the fields come in. */
function sameTranslations(a: Record<string, Translation>, b: Record<string, Translation>) {
  const languages = Object.keys(a).sort();
  if (languages.join() !== Object.keys(b).sort().join()) return false;
  return languages.every((l) =>
    (['question', 'description', 'whatToDo', 'resolutionCriteria'] as const).every(
      (key) => (a[l]?.[key] ?? '') === (b[l]?.[key] ?? ''),
    ),
  );
}

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

/**
 * Change what may still change about an open forecast — why it matters, what people can do,
 * its sources, where it applies, how often this usually happens — and add translations.
 * The question, how it is judged and the date are shown and cannot be edited, in the original
 * and in every translation already saved.
 */
export function ForecastEditForm({
  forecast,
  languages,
}: {
  forecast: EditableForecast;
  /** The languages forecasts can be written in, by their own names. */
  languages: Array<{ id: string; label: string }>;
}) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [values, setValues] = useState({
    description: forecast.description,
    whatToDo: forecast.whatToDo,
    regions: forecast.regions.join(', '),
    baseRate: forecast.baseRate === null ? Number.NaN : Math.round(forecast.baseRate * 100),
    sources: forecast.sources.map((s) => `${s.name}, ${s.url}`).join('\n'),
  });
  const [translations, setTranslations] = useState<Record<string, Words>>(() =>
    Object.fromEntries(
      Object.entries(forecast.translations).map(([language, w]) => [
        language,
        { ...w, description: w.description ?? '' },
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setWords = (language: string, key: keyof Words, value: string) =>
    setTranslations((all) => ({
      ...all,
      [language]: { ...(all[language] ?? NO_WORDS), [key]: value },
    }));
  /** A translation that is already saved: its question and how it is judged are fixed. */
  const saved = (language: string) => forecast.translations[language];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sources = parseSources(values.sources);
    // A translation counts once its question is written; an untouched language is left out.
    const written = Object.entries(translations).filter(
      ([language, w]) => saved(language) || w.question.trim(),
    );
    const ready =
      long(values.whatToDo) &&
      (Number.isNaN(values.baseRate) || chance(values.baseRate)) &&
      sources.length > 0 &&
      sources.length === values.sources.split('\n').filter((l) => l.trim()).length &&
      written.every(
        ([, w]) => isQuestion(w.question) && long(w.whatToDo) && long(w.resolutionCriteria),
      );
    if (!ready) {
      setError({ title: t('eCheck') });
      return;
    }
    const next = {
      description: values.description.trim(),
      whatToDo: values.whatToDo.trim(),
      regions: values.regions
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((r) => r.toUpperCase()),
      baseRate: Number.isNaN(values.baseRate) ? null : values.baseRate / 100,
      sources,
      translations: Object.fromEntries(
        written.map(([language, w]): [string, Translation] => [
          language,
          {
            // Sent back exactly as saved for an existing translation: the server refuses any
            // change to these two.
            question: saved(language)?.question ?? w.question.trim(),
            ...(w.description.trim() ? { description: w.description.trim() } : {}),
            whatToDo: w.whatToDo.trim(),
            resolutionCriteria: saved(language)?.resolutionCriteria ?? w.resolutionCriteria.trim(),
          },
        ]),
      ),
    };
    // Only what really changed is sent, so the activity log says what was edited.
    const changed: Partial<typeof next> = {};
    if (next.description !== forecast.description) changed.description = next.description;
    if (next.whatToDo !== forecast.whatToDo) changed.whatToDo = next.whatToDo;
    if (!same(next.regions, forecast.regions)) changed.regions = next.regions;
    if (Math.round((next.baseRate ?? 0) * 100) !== Math.round((forecast.baseRate ?? 0) * 100))
      changed.baseRate = next.baseRate;
    if (!same(next.sources, forecast.sources)) changed.sources = next.sources;
    if (!sameTranslations(next.translations, forecast.translations))
      changed.translations = next.translations;
    setError(null);
    if (!Object.keys(changed).length) {
      // Nothing differs from what is saved: say so without writing an empty edit to the log.
      toast({ title: t('eSaved'), tone: 'safe' }, 3000);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/forecasts/${forecast.id}`, { method: 'PATCH', json: changed });
      toast({ title: t('eSaved'), tone: 'safe' }, 3000);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiProblem && [400, 409, 422].includes(err.status)
          ? { title: t('eCheck'), detail: err.issues[0]?.message ?? err.message }
          : { title: errors(problemKey(err)) },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <dl className={styles.fixed}>
        <div>
          <dt>{t('fQuestion')}</dt>
          <dd lang={forecast.language} dir="auto">
            {forecast.question}
          </dd>
        </div>
        <div>
          <dt>{t('fCriteria')}</dt>
          <dd lang={forecast.language} dir="auto">
            {forecast.resolutionCriteria}
          </dd>
        </div>
      </dl>
      <Notice title={t('forecastFixed')} />
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
        label={t('fRegions')}
        description={t('fRegionsHint')}
        optionalLabel={common('optional')}
        value={values.regions}
        onChange={(v) => set('regions', v)}
        maxLength={120}
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
      <TextField
        label={t('fSources')}
        description={t('fSourcesHint')}
        multiline
        rows={3}
        value={values.sources}
        onChange={(v) => set('sources', v)}
        isRequired
      />

      <div className={styles.translations}>
        <p className={styles.note}>{t('tHint')}</p>
        {languages
          .filter((l) => l.id !== forecast.language)
          .map((l) => {
            const w = translations[l.id] ?? NO_WORDS;
            const fixed = saved(l.id);
            return (
              <Disclosure
                key={l.id}
                title={
                  fixed ? t('tSaved', { language: l.label }) : t('tTitle', { language: l.label })
                }
                headingLevel={3}
              >
                <div className={styles.form}>
                  {fixed ? (
                    <>
                      <dl className={styles.fixed}>
                        <div>
                          <dt>{t('fQuestion')}</dt>
                          <dd lang={l.id} dir="auto">
                            {fixed.question}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('fCriteria')}</dt>
                          <dd lang={l.id} dir="auto">
                            {fixed.resolutionCriteria}
                          </dd>
                        </div>
                      </dl>
                      <p className={styles.note}>{t('tFixed')}</p>
                    </>
                  ) : (
                    <>
                      <p className={styles.note}>{t('tFixedOnSave')}</p>
                      <TextField
                        label={t('fQuestion')}
                        value={w.question}
                        onChange={(v) => setWords(l.id, 'question', v)}
                        maxLength={240}
                      />
                    </>
                  )}
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
                  {fixed ? null : (
                    <TextField
                      label={t('fCriteria')}
                      multiline
                      rows={2}
                      value={w.resolutionCriteria}
                      onChange={(v) => setWords(l.id, 'resolutionCriteria', v)}
                      maxLength={800}
                    />
                  )}
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
          {common('save')}
        </Button>
      </div>
    </form>
  );
}
