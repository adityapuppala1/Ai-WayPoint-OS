'use client';

import type { HealthReminder } from '@waypoint/api/client';
import {
  Button,
  ConfirmDialog,
  Disclosure,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  SelectField,
  Switch,
  TextField,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './health.module.css';

const REPEATS = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'half-yearly',
  'yearly',
] as const;
type Repeat = (typeof REPEATS)[number];

const IDEAS = [
  'medicine',
  'refill',
  'blood-pressure',
  'dental',
  'eyes',
  'vaccination',
  'screening',
] as const;

/** The person's own reminders: add, pause, delete. Titles are encrypted on the server. */
export function Reminders({
  reminders,
  today,
  timeZone,
}: {
  reminders: HealthReminder[];
  /** YYYY-MM-DD in the person's time zone, the earliest date offered. */
  today: string;
  timeZone: string;
}) {
  const t = useTranslations('health');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const ids = useId();
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('monthly');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<HealthReminder | null>(null);

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/wellbeing/reminders', {
        json: { title: title.trim(), repeat, date, time },
      });
      setTitle('');
      toast({ title: t('reminderSaved'), tone: 'safe' }, 2500);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiProblem && err.code === 'in-the-past') setError(t('reminderPast'));
      else if (err instanceof ApiProblem && err.status === 409) setError(t('reminderLimit'));
      else toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: HealthReminder, enabled: boolean) => {
    try {
      await api(`/api/wellbeing/reminders/${r.id}`, { method: 'PATCH', json: { enabled } });
      router.refresh();
    } catch (err) {
      toast({
        title:
          err instanceof ApiProblem && err.code === 'in-the-past'
            ? t('reminderPast')
            : errors(problemKey(err)),
        tone: 'danger',
      });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/wellbeing/reminders/${deleting.id}`, { method: 'DELETE' });
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
      throw err;
    }
    toast({ title: t('reminderDeleted'), tone: 'safe' }, 2500);
    router.refresh();
  };

  return (
    <>
      {reminders.length ? (
        <ul className={styles.reminders}>
          {reminders.map((r) => (
            <li key={r.id} className={styles.reminder} data-enabled={r.enabled}>
              <Icon name="reminder" size={20} />
              <div className={styles.reminderBody}>
                <span className={styles.reminderTitle} dir="auto">
                  {r.title}
                </span>
                <span className={styles.reminderMeta}>
                  {t(`repeats.${r.repeat}`)}
                  {' · '}
                  {r.enabled && r.nextAt ? t('nextAt', { when: when(r.nextAt) }) : t('reminderOff')}
                </span>
              </div>
              <div className={styles.actions}>
                <Switch
                  isSelected={r.enabled}
                  onChange={(on) => toggle(r, on)}
                  aria-label={`${t('reminderOn')}: ${r.title}`}
                >
                  <span className="wp-visually-hidden">{t('reminderOn')}</span>
                </Switch>
                <Menu
                  label={t('reminderOptions', { title: r.title })}
                  trigger={
                    <IconButton
                      icon="more"
                      label={t('reminderOptions', { title: r.title })}
                      tooltip={false}
                    />
                  }
                >
                  <MenuItem id="delete" icon="delete" tone="danger" onAction={() => setDeleting(r)}>
                    {t('deleteReminder')}
                  </MenuItem>
                </Menu>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>{t('remindersEmpty')}</p>
      )}

      <Disclosure title={t('addReminder')} headingLevel={3} defaultExpanded={!reminders.length}>
        <form className={styles.form} onSubmit={add}>
          <TextField
            label={t('reminderTitle')}
            value={title}
            onChange={(v) => {
              setTitle(v);
              setError(null);
            }}
            maxLength={120}
            autoComplete="off"
          />
          <fieldset className={styles.ideas}>
            <legend className="wp-visually-hidden">{t('ideasLabel')}</legend>
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                className={styles.idea}
                onClick={() => setTitle(t(`ideas.${idea}`))}
              >
                {t(`ideas.${idea}`)}
              </button>
            ))}
          </fieldset>
          <div className={styles.when}>
            <SelectField
              label={t('repeat')}
              options={REPEATS.map((r) => ({
                id: r,
                label: t(`repeats.${r}`),
                textValue: t(`repeats.${r}`),
              }))}
              selectedKey={repeat}
              onSelectionChange={(k) => k && setRepeat(String(k) as Repeat)}
            />
            <div className={styles.nativeField}>
              <label htmlFor={`${ids}-date`}>
                {repeat === 'once' ? t('startDate') : t('startDateRepeat')}
              </label>
              <input
                id={`${ids}-date`}
                type="date"
                value={date}
                min={today}
                required
                onChange={(e) => {
                  setDate(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className={styles.nativeField}>
              <label htmlFor={`${ids}-time`}>{t('time')}</label>
              <input
                id={`${ids}-time`}
                type="time"
                value={time}
                required
                onChange={(e) => {
                  setTime(e.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <p className={styles.hint}>{t('reminderWhere')}</p>
          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              icon="add"
              isBusy={busy}
              isDisabled={title.trim().length < 2 || !date || !time}
            >
              {t('saveReminder')}
            </Button>
          </div>
        </form>
      </Disclosure>

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('deleteReminder')}
        confirmLabel={t('deleteReminder')}
        cancelLabel={common('cancel')}
        onConfirm={remove}
        tone="danger"
      >
        <p>{t('deleteReminderBody')}</p>
      </ConfirmDialog>
    </>
  );
}
