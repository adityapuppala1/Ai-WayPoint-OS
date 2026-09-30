'use client';

import type { JournalEntry } from '@waypoint/api/client';
import type { CrisisResponsePlan } from '@waypoint/core';
import { Button, ConfirmDialog, SelectField, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { CrisisCard } from '@/components/support/CrisisCard';
import { api } from '@/lib/api';
import styles from './mind.module.css';

const PROMPTS = [
  'free',
  'went-well',
  'on-my-mind',
  'grateful',
  'kind-to-self',
  'next-step',
  'proud',
] as const;
type Prompt = (typeof PROMPTS)[number];
const isPrompt = (p: string | null): p is Prompt =>
  p !== null && (PROMPTS as readonly string[]).includes(p);

type Saved = { entry: JournalEntry; screening: { plan: CrisisResponsePlan | null } };

/** Write, read back, edit and delete private entries. */
export function Journal({ entries }: { entries: JournalEntry[] }) {
  const t = useTranslations('mind');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt>('free');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<CrisisResponsePlan | null>(null);

  const after = (res: Saved, message: string) => {
    if (res.screening.plan) setCrisis(res.screening.plan);
    else toast({ title: message, tone: 'safe' }, 2500);
    router.refresh();
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await api<Saved>('/api/mind/journal', {
        json: { promptId: prompt, body: body.trim() },
      });
      setBody('');
      setPrompt('free');
      after(res, t('saved'));
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const save = async (id: string) => {
    if (!draft.trim()) return;
    try {
      const res = await api<Saved>(`/api/mind/journal/${id}`, {
        method: 'PATCH',
        json: { body: draft.trim() },
      });
      setEditing(null);
      after(res, t('saved'));
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/mind/journal/${deleting}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  return (
    <>
      {crisis ? <CrisisCard plan={crisis} onStay={() => setCrisis(null)} /> : null}
      <form className={styles.form} onSubmit={add}>
        <SelectField
          label={t('prompt')}
          options={PROMPTS.map((p) => ({
            id: p,
            label: t(`prompts.${p}`),
            textValue: t(`prompts.${p}`),
          }))}
          selectedKey={prompt}
          onSelectionChange={(k) => k && setPrompt(String(k) as Prompt)}
        />
        <TextField
          label={prompt === 'free' ? t('entry') : t(`prompts.${prompt}`)}
          value={body}
          onChange={setBody}
          multiline
          rows={5}
          maxLength={20_000}
        />
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            icon="check"
            isBusy={busy}
            isDisabled={!body.trim()}
          >
            {t('save')}
          </Button>
        </div>
      </form>

      {entries.length ? (
        <ul className={styles.entries}>
          {entries.map((e) => (
            <li key={e.id} className={styles.entry}>
              <div className={styles.entryHead}>
                <p className="wp-meta">
                  {t('written', {
                    date: format.dateTime(new Date(e.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
                </p>
                {editing === e.id ? null : (
                  <div className={styles.actions}>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon="edit"
                      onPress={() => {
                        setEditing(e.id);
                        setDraft(e.body);
                      }}
                    >
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      icon="delete"
                      onPress={() => setDeleting(e.id)}
                    >
                      {t('delete')}
                    </Button>
                  </div>
                )}
              </div>
              {isPrompt(e.promptId) && e.promptId !== 'free' ? (
                <p className={styles.entryPrompt}>{t(`prompts.${e.promptId}`)}</p>
              ) : null}
              {editing === e.id ? (
                <div className={styles.form}>
                  <TextField
                    label={t('entry')}
                    value={draft}
                    onChange={setDraft}
                    multiline
                    rows={5}
                    maxLength={20_000}
                  />
                  <div className={styles.actions}>
                    <Button variant="primary" icon="check" onPress={() => save(e.id)}>
                      {t('update')}
                    </Button>
                    <Button variant="quiet" onPress={() => setEditing(null)}>
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={styles.entryBody} dir="auto">
                  {e.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>{t('empty')}</p>
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={t('delete')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={remove}
        tone="danger"
      >
        {t('deleteConfirm')}
      </ConfirmDialog>
    </>
  );
}
