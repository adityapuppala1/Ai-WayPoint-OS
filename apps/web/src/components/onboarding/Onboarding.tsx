'use client';

import { authClient } from '@waypoint/auth/client';
import { TIME_ZONE_COUNTRY } from '@waypoint/content/time-zones';
import {
  Button,
  IconButton,
  Notice,
  Radio,
  RadioGroup,
  Route as RouteLine,
  SearchField,
  Segmented,
  SelectField,
  SliderField,
  type Station,
  Switch,
  TextField,
} from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LanguagePicker } from '@/components/LanguagePicker';
import { api } from '@/lib/api';
import {
  COMMON_SKILLS,
  LIFE_STAGE_OPTIONS,
  ONBOARDING_CONSENTS,
  SITUATION_OPTIONS,
  WORK_TYPE_OPTIONS,
} from '@/lib/options';
import { matchesQuery } from '@/lib/search';
import styles from './onboarding.module.css';

const STEPS = ['place', 'situation', 'skills', 'time', 'privacy'] as const;
type StepKey = (typeof STEPS)[number];

interface SkillOption {
  id: string;
  name: string;
  /** The English name, so people can search with the words they know from work. */
  alt?: string;
  category: string;
}

export interface OnboardingInitial {
  displayName: string;
  country: string;
  timezone: string;
  situation: string | null;
  lifeStage: string | null;
  workType: string | null;
  hoursPerWeek: number;
  learningBudget: 'free' | 'low' | 'any';
  attentionBudget: number;
  consents: Record<string, boolean> | null;
}

export function Onboarding({
  signedIn,
  countries,
  skills,
  initial,
}: {
  signedIn: boolean;
  countries: Array<{ code: string; name: string }>;
  skills: SkillOption[];
  initial: OnboardingInitial;
}) {
  const t = useTranslations('start');
  const common = useTranslations('common');
  const a11y = useTranslations('a11y');
  const situations = useTranslations('situations');
  const lifeStages = useTranslations('lifeStages');
  const workTypes = useTranslations('workTypes');
  const levels = useTranslations('skillLevels');
  const consentText = useTranslations('consents');
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial.displayName);
  const [country, setCountry] = useState(initial.country);
  // Nothing known yet (first page, no country from the network): suggest the country the
  // device's time zone belongs to. It is only a starting point on the first step, to change.
  useEffect(() => {
    if (initial.country) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const guess = zone ? TIME_ZONE_COUNTRY[zone] : undefined;
    if (guess) setCountry((current) => current || guess);
  }, [initial.country]);
  const [situation, setSituation] = useState<string | null>(initial.situation);
  const [lifeStage, setLifeStage] = useState<string | null>(initial.lifeStage);
  const [workType, setWorkType] = useState<string | null>(initial.workType);
  const [picked, setPicked] = useState<Array<{ skillId: string; level: number }>>([]);
  const [query, setQuery] = useState('');
  const [hours, setHours] = useState(initial.hoursPerWeek);
  const [budget, setBudget] = useState<string>(initial.learningBudget);
  const [attention, setAttention] = useState(String(initial.attentionBudget));
  const [consents, setConsents] = useState<Record<string, boolean>>(
    Object.fromEntries(ONBOARDING_CONSENTS.map((c) => [c, initial.consents?.[c] ?? false])),
  );

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // Move focus to the new step's heading so screen readers announce it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step changes
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const current: StepKey = STEPS[step] ?? 'place';
  const skillName = useMemo(() => new Map(skills.map((s) => [s.id, s.name])), [skills]);

  const matches = useMemo(() => {
    const q = query.trim();
    const taken = new Set(picked.map((p) => p.skillId));
    const pool = q
      ? skills.filter((s) => matchesQuery(q, s.name, s.alt, s.id))
      : COMMON_SKILLS.map((id) => skills.find((s) => s.id === id)).filter((s): s is SkillOption =>
          Boolean(s),
        );
    return pool.filter((s) => !taken.has(s.id)).slice(0, 8);
  }, [query, skills, picked]);

  const stations: Station[] = STEPS.map((key, i) => ({
    id: key,
    label: t(`steps.${key}`),
    state: i < step ? 'done' : i === step ? 'current' : 'upcoming',
  }));

  const levelOptions = [1, 2, 3, 4].map((l) => ({
    id: String(l),
    label: levels(String(l) as '1'),
  }));

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!signedIn) {
        const res = await authClient.signIn.anonymous();
        if (res.error) throw new Error(res.error.message);
      }
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || initial.timezone || 'UTC';
      await api('/api/me/onboarding', {
        json: {
          profile: {
            displayName: name.trim() ? name.trim() : null,
            country: country || null,
            timezone,
            situation,
            lifeStage,
            workType,
            hoursPerWeek: hours,
            learningBudget: budget,
            attentionBudget: Number(attention),
          },
          consents,
          skills: picked,
        },
      });
      router.push((situation && situation !== 'steady' ? '/path/new' : '/') as Route);
      router.refresh();
    } catch {
      setError(t('error'));
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) setStep(step + 1);
    else void finish();
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>{t('title')}</h1>
        <p className="wp-lead">{t('lead')}</p>
      </header>

      <RouteLine
        stations={stations}
        orientation="horizontal"
        compact
        module="today"
        label={t('progressLabel')}
        stateLabels={{
          done: a11y('routeDone'),
          current: a11y('routeCurrent'),
          upcoming: a11y('routeUpcoming'),
        }}
      />

      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <p className="wp-meta">{common('stepOf', { current: step + 1, total: STEPS.length })}</p>

        {current === 'place' ? (
          <div className={styles.step}>
            <h2 ref={headingRef} tabIndex={-1}>
              {t('placeTitle')}
            </h2>
            <p className="wp-secondary">{t('placeLead')}</p>
            <SelectField
              label={t('country')}
              placeholder={t('countryPlaceholder')}
              options={countries.map((c) => ({ id: c.code, label: c.name, textValue: c.name }))}
              selectedKey={country || null}
              onSelectionChange={(k) => setCountry(k ? String(k) : '')}
            />
            <LanguagePicker signedIn={signedIn} />
            <TextField
              label={t('name')}
              description={t('nameHint')}
              optionalLabel={common('optional')}
              value={name}
              onChange={setName}
              maxLength={60}
              autoComplete="given-name"
            />
          </div>
        ) : null}

        {current === 'situation' ? (
          <div className={styles.step}>
            <h2 ref={headingRef} tabIndex={-1}>
              {t('situationTitle')}
            </h2>
            <RadioGroup
              label={t('situationLead')}
              value={situation ?? ''}
              onChange={(v) => setSituation(v || null)}
            >
              {SITUATION_OPTIONS.map((s) => (
                <Radio key={s} value={s}>
                  {situations(s)}
                </Radio>
              ))}
            </RadioGroup>
            <div className={styles.pair}>
              <SelectField
                label={t('lifeStage')}
                optionalLabel={common('optional')}
                options={LIFE_STAGE_OPTIONS.map((l) => ({
                  id: l,
                  label: lifeStages(l),
                  textValue: lifeStages(l),
                }))}
                selectedKey={lifeStage}
                onSelectionChange={(k) => setLifeStage(k ? String(k) : null)}
              />
              <SelectField
                label={t('workType')}
                optionalLabel={common('optional')}
                options={WORK_TYPE_OPTIONS.map((w) => ({
                  id: w,
                  label: workTypes(w),
                  textValue: workTypes(w),
                }))}
                selectedKey={workType}
                onSelectionChange={(k) => setWorkType(k ? String(k) : null)}
              />
            </div>
          </div>
        ) : null}

        {current === 'skills' ? (
          <div className={styles.step}>
            <h2 ref={headingRef} tabIndex={-1}>
              {t('skillsTitle')}
            </h2>
            <p className="wp-secondary">{t('skillsLead')}</p>
            <SearchField
              label={t('skillsSearch')}
              placeholder={t('skillsSearchPlaceholder')}
              value={query}
              onChange={setQuery}
            />
            <div>
              {!query ? <p className={styles.subhead}>{t('skillsSuggested')}</p> : null}
              <ul className={styles.chips}>
                {matches.map((s) => (
                  <li key={s.id}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="add"
                      onPress={() => {
                        setPicked((p) => [...p, { skillId: s.id, level: 2 }]);
                        setQuery('');
                      }}
                    >
                      {s.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="wp-meta" aria-live="polite">
              {t('skillsAdded', { count: picked.length })}
            </p>
            {picked.length ? (
              <ul className={styles.picked}>
                {picked.map((p) => {
                  const label = skillName.get(p.skillId) ?? p.skillId;
                  return (
                    <li key={p.skillId} className={styles.pickedRow}>
                      <span className={styles.pickedName}>{label}</span>
                      <Segmented
                        label={t('levelFor', { skill: label })}
                        options={levelOptions}
                        value={String(p.level)}
                        onChange={(v) =>
                          setPicked((all) =>
                            all.map((x) =>
                              x.skillId === p.skillId ? { ...x, level: Number(v) } : x,
                            ),
                          )
                        }
                      />
                      <IconButton
                        icon="close"
                        label={`${common('remove')}: ${label}`}
                        onPress={() =>
                          setPicked((all) => all.filter((x) => x.skillId !== p.skillId))
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        {current === 'time' ? (
          <div className={styles.step}>
            <h2 ref={headingRef} tabIndex={-1}>
              {t('timeTitle')}
            </h2>
            <p className="wp-secondary">{t('timeLead')}</p>
            <SliderField
              label={t('hours')}
              minValue={1}
              maxValue={20}
              step={1}
              value={hours}
              onChange={(v) => setHours(Array.isArray(v) ? (v[0] ?? 1) : v)}
            />
            <RadioGroup
              label={t('budget')}
              value={budget}
              onChange={setBudget}
              orientation="horizontal"
            >
              <Radio value="free">{t('budgetFree')}</Radio>
              <Radio value="low">{t('budgetLow')}</Radio>
              <Radio value="any">{t('budgetAny')}</Radio>
            </RadioGroup>
            <RadioGroup label={t('attention')} value={attention} onChange={setAttention}>
              <Radio value="0">{t('attention0')}</Radio>
              <Radio value="1">{t('attention1')}</Radio>
              <Radio value="2">{t('attention2')}</Radio>
              <Radio value="3">{t('attention3')}</Radio>
            </RadioGroup>
          </div>
        ) : null}

        {current === 'privacy' ? (
          <div className={styles.step}>
            <h2 ref={headingRef} tabIndex={-1}>
              {t('privacyTitle')}
            </h2>
            <p className="wp-secondary">{t('privacyLead')}</p>
            <div className={styles.switches}>
              {ONBOARDING_CONSENTS.map((c) => (
                <Switch
                  key={c}
                  isSelected={consents[c] ?? false}
                  onChange={(v) => setConsents((all) => ({ ...all, [c]: v }))}
                  description={consentText(`${c}Hint`)}
                >
                  {consentText(c)}
                </Switch>
              ))}
            </div>
            <p className={styles.agree}>
              {t.rich('agree', {
                terms: (chunks) => <Link href={'/terms' as Route}>{chunks}</Link>,
                privacy: (chunks) => <Link href={'/privacy' as Route}>{chunks}</Link>,
              })}
            </p>
          </div>
        ) : null}

        {error ? <Notice tone="danger" role="alert" title={error} /> : null}

        <div className={styles.footer}>
          {step > 0 ? (
            <Button variant="quiet" icon="back" onPress={() => setStep(step - 1)} isDisabled={busy}>
              {common('back')}
            </Button>
          ) : (
            <span />
          )}
          <div className="wp-row">
            {current === 'skills' && !picked.length ? (
              <Button variant="quiet" onPress={() => setStep(step + 1)}>
                {common('skipForNow')}
              </Button>
            ) : null}
            <Button type="submit" variant="primary" size="lg" isBusy={busy}>
              {step < STEPS.length - 1 ? common('continue') : busy ? t('finishing') : t('finish')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
