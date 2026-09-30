'use client';

import type { Profile } from '@waypoint/api/client';
import { authClient } from '@waypoint/auth/client';
import {
  Button,
  Icon,
  LinkButton,
  Notice,
  Panel,
  Radio,
  RadioGroup,
  Segmented,
  SelectField,
  SliderField,
  Switch,
  TextField,
  toast,
} from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SendConfirmation } from '@/components/auth/SendConfirmation';
import { LanguagePicker } from '@/components/LanguagePicker';
import { api } from '@/lib/api';
import { forgetOfflineCopy } from '@/lib/offline';
import { LIFE_STAGE_OPTIONS, SITUATION_OPTIONS, WORK_TYPE_OPTIONS } from '@/lib/options';
import { type Preferences, savePreferences } from '@/lib/preferences';
import styles from './settings.module.css';

export function SettingsForm({
  profile,
  countries,
  account,
}: {
  profile: Profile;
  countries: Array<{ code: string; name: string }>;
  account: { isGuest: boolean; email: string | null; canConfirm: boolean; emailVerified: boolean };
}) {
  const t = useTranslations('settings');
  const start = useTranslations('start');
  const theme = useTranslations('theme');
  const common = useTranslations('common');
  const shell = useTranslations('shell');
  const situations = useTranslations('situations');
  const lifeStages = useTranslations('lifeStages');
  const workTypes = useTranslations('workTypes');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [p, setP] = useState(profile);
  const [busy, setBusy] = useState(false);

  const patch = async (changes: Partial<Profile>, quiet = false) => {
    setP((cur) => ({ ...cur, ...changes }));
    try {
      await api('/api/me/profile', { method: 'PATCH', json: changes });
      if (!quiet) toast({ title: t('saved'), tone: 'safe' }, 2500);
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  /**
   * Theme and lite mode: the cookie the pages are drawn from, then the profile. In that order,
   * because saving the profile redraws the page from the cookie.
   */
  const appear = async (choice: Preferences, changes: Partial<Profile>) => {
    setP((cur) => ({ ...cur, ...changes }));
    await savePreferences(choice);
    await patch(changes, true);
  };

  const saveAbout = async () => {
    setBusy(true);
    await patch({
      displayName: p.displayName?.trim() ? p.displayName.trim() : null,
      country: p.country,
      situation: p.situation,
      lifeStage: p.lifeStage,
      workType: p.workType,
      hoursPerWeek: p.hoursPerWeek,
      learningBudget: p.learningBudget,
    });
    setBusy(false);
  };

  return (
    <div className={styles.stack}>
      <Panel title={t('profileTitle')} as="section">
        <div className={styles.form}>
          <TextField
            label={start('name')}
            optionalLabel={common('optional')}
            value={p.displayName ?? ''}
            onChange={(v) => setP({ ...p, displayName: v })}
            maxLength={60}
          />
          <SelectField
            label={start('country')}
            options={countries.map((c) => ({ id: c.code, label: c.name, textValue: c.name }))}
            selectedKey={p.country}
            onSelectionChange={(k) => setP({ ...p, country: k ? String(k) : null })}
          />
          <SelectField
            label={start('situationTitle')}
            options={SITUATION_OPTIONS.map((s) => ({
              id: s,
              label: situations(s),
              textValue: situations(s),
            }))}
            selectedKey={p.situation}
            onSelectionChange={(k) =>
              setP({ ...p, situation: (k ? String(k) : null) as Profile['situation'] })
            }
          />
          <div className={styles.pair}>
            <SelectField
              label={start('lifeStage')}
              optionalLabel={common('optional')}
              options={LIFE_STAGE_OPTIONS.map((l) => ({
                id: l,
                label: lifeStages(l),
                textValue: lifeStages(l),
              }))}
              selectedKey={p.lifeStage}
              onSelectionChange={(k) =>
                setP({ ...p, lifeStage: (k ? String(k) : null) as Profile['lifeStage'] })
              }
            />
            <SelectField
              label={start('workType')}
              optionalLabel={common('optional')}
              options={WORK_TYPE_OPTIONS.map((w) => ({
                id: w,
                label: workTypes(w),
                textValue: workTypes(w),
              }))}
              selectedKey={p.workType}
              onSelectionChange={(k) =>
                setP({ ...p, workType: (k ? String(k) : null) as Profile['workType'] })
              }
            />
          </div>
          <SliderField
            label={start('hours')}
            minValue={1}
            maxValue={20}
            value={p.hoursPerWeek}
            onChange={(v) => setP({ ...p, hoursPerWeek: Array.isArray(v) ? (v[0] ?? 1) : v })}
          />
          <RadioGroup
            label={start('budget')}
            value={p.learningBudget}
            onChange={(v) => setP({ ...p, learningBudget: v as Profile['learningBudget'] })}
            orientation="horizontal"
          >
            <Radio value="free">{start('budgetFree')}</Radio>
            <Radio value="low">{start('budgetLow')}</Radio>
            <Radio value="any">{start('budgetAny')}</Radio>
          </RadioGroup>
          <div>
            <Button variant="primary" icon="check" onPress={saveAbout} isBusy={busy}>
              {common('save')}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title={t('appearanceTitle')} as="section">
        <div className={styles.form}>
          <LanguagePicker signedIn />
          <div className={styles.field}>
            <p className={styles.label}>{theme('label')}</p>
            <Segmented
              label={theme('label')}
              value={p.theme}
              onChange={(v) => {
                const chosen = v as Profile['theme'];
                // Straight away, so the page never shows the old theme while it is saved.
                const root = document.documentElement;
                if (chosen === 'system') root.removeAttribute('data-theme');
                else root.setAttribute('data-theme', chosen);
                void appear({ theme: chosen }, { theme: chosen });
              }}
              options={[
                { id: 'system', label: theme('system'), icon: 'system' },
                { id: 'light', label: theme('light'), icon: 'light' },
                { id: 'dark', label: theme('dark'), icon: 'dark' },
              ]}
            />
          </div>
          <Switch
            isSelected={p.liteMode}
            description={t('liteModeHint')}
            onChange={(v) => {
              if (v) document.documentElement.setAttribute('data-lite', 'true');
              else document.documentElement.removeAttribute('data-lite');
              void appear({ lite: v }, { liteMode: v });
            }}
          >
            {t('liteMode')}
          </Switch>
        </div>
      </Panel>

      <Panel title={t('remindersTitle')} as="section">
        <div className={styles.form}>
          <RadioGroup
            label={start('attention')}
            value={String(p.attentionBudget)}
            onChange={(v) => void patch({ attentionBudget: Number(v) })}
          >
            <Radio value="0">{start('attention0')}</Radio>
            <Radio value="1">{start('attention1')}</Radio>
            <Radio value="2">{start('attention2')}</Radio>
            <Radio value="3">{start('attention3')}</Radio>
          </RadioGroup>
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>{t('quietHours')}</legend>
            <div className={styles.pair}>
              <label className={styles.time}>
                <span>{t('quietStart')}</span>
                <input
                  type="time"
                  value={p.quietStart ?? '21:00'}
                  onChange={(e) => setP({ ...p, quietStart: e.target.value })}
                  onBlur={() => void patch({ quietStart: p.quietStart }, true)}
                />
              </label>
              <label className={styles.time}>
                <span>{t('quietEnd')}</span>
                <input
                  type="time"
                  value={p.quietEnd ?? '08:00'}
                  onChange={(e) => setP({ ...p, quietEnd: e.target.value })}
                  onBlur={() => void patch({ quietEnd: p.quietEnd }, true)}
                />
              </label>
            </div>
          </fieldset>
          <p className="wp-secondary">
            {t('timezone')}: {p.timezone}
          </p>
        </div>
      </Panel>

      <Panel title={t('accountTitle')} as="section" id="account">
        <div className={styles.form}>
          {account.isGuest ? (
            <>
              <p>{t('guestAccount')}</p>
              <div>
                <LinkButton href={'/sign-up' as Route} variant="primary" icon="account">
                  {shell('createAccount')}
                </LinkButton>
              </div>
            </>
          ) : (
            <>
              <p>{t('signedInAs', { email: account.email ?? '' })}</p>
              {account.canConfirm && account.email ? (
                account.emailVerified ? (
                  <p className={styles.confirmed}>
                    <Icon name="safe" size={18} /> {t('emailConfirmed')}
                  </p>
                ) : (
                  <Notice title={t('emailUnconfirmed')}>
                    <div className="wp-stack">
                      <p>{t('emailUnconfirmedBody')}</p>
                      <SendConfirmation email={account.email} variant="secondary" />
                    </div>
                  </Notice>
                )
              ) : null}
            </>
          )}
          <div className="wp-row">
            <LinkButton href={'/settings/privacy' as Route} variant="secondary" icon="lock">
              {t('privacyTitle')}
            </LinkButton>
            {!account.isGuest ? (
              <Button
                variant="quiet"
                icon="signOut"
                onPress={async () => {
                  await authClient.signOut();
                  await forgetOfflineCopy();
                  router.push('/welcome' as Route);
                  router.refresh();
                }}
              >
                {shell('signOut')}
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}
