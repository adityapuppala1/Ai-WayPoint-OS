'use client';

import type { maintenance } from '@waypoint/api';
import {
  Button,
  ConfirmDialog,
  Icon,
  Notice,
  SelectField,
  Switch,
  TextField,
  toast,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useId, useState, useTransition } from 'react';
import { ApiProblem, api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

type View = Awaited<ReturnType<typeof maintenance.maintenanceView>>;

/** An ISO time as the value of a datetime-local field, in this browser's time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;

/** A native date-and-time field, labelled, as the reminders' fields are. */
function When({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className={styles.dateField}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The console's maintenance page: closing the platform for maintenance (with what people see
 * and when it ends), an announcement on every page, backups, and housekeeping to run now.
 */
export function MaintenanceConsole({ view, at }: { view: View; at: string }) {
  const t = useTranslations('admin.maint');
  const errorsT = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  // Times are shown in this browser's own time zone, which the server does not know: the
  // fields are filled once the page is running here, so both draw the same page first.
  const [m, setM] = useState({
    on: view.maintenance.on,
    message: view.maintenance.message,
    startsAt: '',
    until: '',
  });
  const [a, setA] = useState({
    on: view.announcement.on,
    message: view.announcement.message,
    tone: view.announcement.tone,
    until: '',
  });
  const [backup, setBackup] = useState({ at: '', note: '' });
  useEffect(() => {
    setM((s) => ({
      ...s,
      startsAt: toLocalInput(view.maintenance.startsAt),
      until: toLocalInput(view.maintenance.until),
    }));
    setA((s) => ({ ...s, until: toLocalInput(view.announcement.until) }));
    setBackup((b) => ({ ...b, at: toLocalInput(new Date().toISOString()) }));
  }, [view.maintenance.startsAt, view.maintenance.until, view.announcement.until]);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const send = async (key: string, json: unknown, done: string) => {
    setBusy(key);
    setProblems({});
    try {
      await api('/api/admin/maintenance', { method: 'PUT', json });
      toast({ title: done, tone: 'safe' });
      refresh();
    } catch (err) {
      if (err instanceof ApiProblem && err.issues.length)
        setProblems(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
      throw err;
    } finally {
      setBusy(null);
    }
  };

  const maintenanceBody = () => ({
    maintenance: {
      on: m.on,
      message: m.message,
      startsAt: fromLocalInput(m.startsAt),
      until: fromLocalInput(m.until),
    },
  });

  const saveMaintenance = (e: FormEvent) => {
    e.preventDefault();
    // Closing the platform is asked about first; opening it again is not.
    if (m.on && !view.maintenance.on) setConfirming(true);
    else
      void send('maintenance', maintenanceBody(), m.on ? t('savedOn') : t('savedOff')).catch(
        () => undefined,
      );
  };

  const run = async (task: 'retention' | 'rate-limits' | 'keys') => {
    setBusy(task);
    try {
      const result = await api<{ done: Record<string, number> }>(
        '/api/admin/maintenance/housekeeping',
        { method: 'POST', json: { task } },
      );
      const total = Object.entries(result.done)
        .filter(([k]) => k !== 'keysRemaining' && k !== 'remaining')
        .reduce((n, [, v]) => n + v, 0);
      toast({ title: t(`tasks.${task}.done`, { n: format.number(total) }), tone: 'safe' });
      refresh();
    } catch (err) {
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const state = view.maintenance.active
    ? t('stateOn')
    : view.maintenance.on && view.maintenance.startsAt
      ? t('stateScheduled', {
          from: format.dateTime(new Date(view.maintenance.startsAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        })
      : t('stateOff');
  const backupAge = view.backup
    ? (new Date(at).getTime() - new Date(view.backup.at).getTime()) / 86_400_000
    : null;

  return (
    <div className="wp-stack">
      <section
        className={styles.intCard}
        aria-labelledby="maint-title"
        data-status={view.maintenance.active ? 'failing' : undefined}
      >
        <header className={styles.intHead}>
          <h3 id="maint-title">{t('maintenanceTitle')}</h3>
          <span
            className={styles.statusPill}
            data-status={view.maintenance.active ? 'failing' : 'ok'}
          >
            <Icon name={view.maintenance.active ? 'caution' : 'safe'} size={16} />
            {state}
          </span>
        </header>
        <p className="wp-meta">{t('maintenanceLead')}</p>
        <form className={styles.intForm} onSubmit={saveMaintenance} noValidate>
          <Switch isSelected={m.on} onChange={(on) => setM((s) => ({ ...s, on }))}>
            {t('maintenanceSwitch')}
          </Switch>
          <TextField
            label={t('message')}
            description={t('messageHint')}
            multiline
            rows={3}
            maxLength={600}
            value={m.message}
            onChange={(message) => setM((s) => ({ ...s, message }))}
            errorMessage={problems['maintenance.message']}
            isInvalid={Boolean(problems['maintenance.message'])}
          />
          <div className={styles.pair}>
            <When
              label={t('startsAt')}
              value={m.startsAt}
              onChange={(startsAt) => setM((s) => ({ ...s, startsAt }))}
            />
            <When
              label={t('until')}
              value={m.until}
              onChange={(until) => setM((s) => ({ ...s, until }))}
              error={problems['maintenance.until']}
            />
          </div>
          <div className="wp-row">
            <Button
              type="submit"
              variant={m.on && !view.maintenance.on ? 'danger' : 'primary'}
              size="sm"
              isBusy={busy === 'maintenance'}
            >
              {t('save')}
            </Button>
          </div>
        </form>
        <ConfirmDialog
          isOpen={confirming}
          onOpenChange={setConfirming}
          title={t('confirmTitle')}
          confirmLabel={t('confirmButton')}
          cancelLabel={t('cancel')}
          onConfirm={() => send('maintenance', maintenanceBody(), t('savedOn'))}
        >
          <p>{t('confirmBody')}</p>
        </ConfirmDialog>
      </section>

      <section className={styles.intCard} aria-labelledby="announce-title">
        <header className={styles.intHead}>
          <h3 id="announce-title">{t('announcementTitle')}</h3>
          <span
            className={styles.statusPill}
            data-status={view.announcement.active ? 'untested' : undefined}
          >
            <Icon name={view.announcement.active ? 'bell' : 'bellOff'} size={16} />
            {view.announcement.active ? t('shown') : t('notShown')}
          </span>
        </header>
        <p className="wp-meta">{t('announcementLead')}</p>
        <form
          className={styles.intForm}
          onSubmit={(e) => {
            e.preventDefault();
            void send(
              'announcement',
              {
                announcement: {
                  on: a.on,
                  message: a.message,
                  tone: a.tone,
                  until: fromLocalInput(a.until),
                },
              },
              t('savedAnnouncement'),
            ).catch(() => undefined);
          }}
          noValidate
        >
          <Switch isSelected={a.on} onChange={(on) => setA((s) => ({ ...s, on }))}>
            {t('announcementSwitch')}
          </Switch>
          <TextField
            label={t('message')}
            multiline
            rows={2}
            maxLength={400}
            value={a.message}
            onChange={(message) => setA((s) => ({ ...s, message }))}
            errorMessage={problems['announcement.message']}
            isInvalid={Boolean(problems['announcement.message'])}
          />
          <div className={styles.pair}>
            <SelectField
              label={t('tone')}
              options={[
                { id: 'info', label: t('toneInfo') },
                { id: 'caution', label: t('toneCaution') },
              ]}
              selectedKey={a.tone}
              onSelectionChange={(k) => setA((s) => ({ ...s, tone: k as 'info' | 'caution' }))}
            />
            <When
              label={t('until')}
              value={a.until}
              onChange={(until) => setA((s) => ({ ...s, until }))}
            />
          </div>
          {a.on && a.message.trim() ? (
            <div className={styles.preview}>
              <p className="wp-meta">{t('preview')}</p>
              <Notice tone={a.tone} title={a.message} role="note" />
            </div>
          ) : null}
          <div className="wp-row">
            <Button type="submit" variant="primary" size="sm" isBusy={busy === 'announcement'}>
              {t('save')}
            </Button>
          </div>
        </form>
      </section>

      <section
        className={styles.intCard}
        aria-labelledby="backup-title"
        data-status={backupAge === null || backupAge > 7 ? 'failing' : undefined}
      >
        <header className={styles.intHead}>
          <h3 id="backup-title">{t('backupTitle')}</h3>
          <span
            className={styles.statusPill}
            data-status={backupAge !== null && backupAge <= 7 ? 'ok' : 'failing'}
          >
            <Icon name={backupAge !== null && backupAge <= 7 ? 'safe' : 'caution'} size={16} />
            {view.backup
              ? t('backupNoted', {
                  when: format.relativeTime(new Date(view.backup.at), new Date(at)),
                })
              : t('backupNever')}
          </span>
        </header>
        {view.backup ? (
          <p className="wp-meta" dir="auto">
            {view.backup.note}
          </p>
        ) : null}
        {view.canDownloadBackup ? (
          <>
            <p>{t('backupEmbedded')}</p>
            <div className="wp-row">
              <a className={styles.downloadLink} href="/api/admin/maintenance/backup" download>
                <Icon name="download" size={18} />
                {t('download')}
              </a>
            </div>
          </>
        ) : (
          <p>{t('backupPostgres')}</p>
        )}
        <p className="wp-meta">{t('backupSensitive')}</p>
        <form
          className={styles.intForm}
          onSubmit={(e) => {
            e.preventDefault();
            void send(
              'backup',
              {
                backup: {
                  at: fromLocalInput(backup.at) ?? new Date().toISOString(),
                  note: backup.note,
                },
              },
              t('backupSaved'),
            )
              .then(() => setBackup((b) => ({ ...b, note: '' })))
              .catch(() => undefined);
          }}
          noValidate
        >
          <p className="wp-strong">{t('backupRecord')}</p>
          <div className={styles.pair}>
            <When
              label={t('backupAt')}
              value={backup.at}
              onChange={(v) => setBackup((b) => ({ ...b, at: v }))}
            />
            <TextField
              label={t('backupNote')}
              placeholder={t('backupNotePlaceholder')}
              value={backup.note}
              maxLength={300}
              onChange={(note) => setBackup((b) => ({ ...b, note }))}
              errorMessage={problems['backup.note']}
              isInvalid={Boolean(problems['backup.note'])}
            />
          </div>
          <div className="wp-row">
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              isDisabled={backup.note.trim().length < 2}
              isBusy={busy === 'backup'}
            >
              {t('backupSave')}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.intCard} aria-labelledby="house-title">
        <header className={styles.intHead}>
          <h3 id="house-title">{t('houseTitle')}</h3>
        </header>
        <ul className={styles.tasks}>
          {(['retention', 'rate-limits', 'keys'] as const).map((task) => (
            <li key={task}>
              <div>
                <p className="wp-strong">{t(`tasks.${task}.title`)}</p>
                <p className="wp-meta">
                  {t(`tasks.${task}.lead`)}
                  {task === 'rate-limits'
                    ? ` ${t('limitsNow', {
                        counted: format.number(view.rateLimits.counted),
                        hour: format.number(view.rateLimits.lastHour),
                      })}`
                    : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                isBusy={busy === task}
                isDisabled={busy !== null}
                onPress={() => void run(task)}
              >
                {t(`tasks.${task}.run`)}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
