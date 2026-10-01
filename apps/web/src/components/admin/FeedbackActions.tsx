'use client';

import { Button, Disclosure, SelectField, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { api, problemKey } from '@/lib/api';
import styles from './admin.module.css';

const STATUSES = ['new', 'planned', 'done', 'wont'] as const;
type Status = (typeof STATUSES)[number];

/**
 * What the team does with one piece of feedback: move it to another state, keep a note for
 * the rest of the team, and (only when the person asked) write back by email.
 */
export function FeedbackActions({
  id,
  status,
  note,
  replyTo,
}: {
  id: string;
  status: Status;
  note: string | null;
  replyTo: string | null;
}) {
  const t = useTranslations('admin.fb');
  const errorsT = useTranslations('errors');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<Status>(status);
  const [nextNote, setNextNote] = useState(note ?? '');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<'save' | 'reply' | null>(null);
  const changed = nextStatus !== status || nextNote.trim() !== (note ?? '');

  const run = async (kind: 'save' | 'reply', call: () => Promise<unknown>, done: string) => {
    setBusy(kind);
    try {
      await call();
      toast({ title: done, tone: 'safe' });
      if (kind === 'reply') setReply('');
      startTransition(() => router.refresh());
    } catch (err) {
      toast({ title: errorsT(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run(
      'save',
      () =>
        api(`/api/admin/feedback/${id}`, {
          method: 'PATCH',
          json: {
            ...(nextStatus !== status ? { status: nextStatus } : {}),
            ...(nextNote.trim() !== (note ?? '') ? { note: nextNote.trim() } : {}),
          },
        }),
      t('saved'),
    );

  const send = () =>
    run(
      'reply',
      () => api(`/api/admin/feedback/${id}/reply`, { method: 'POST', json: { message: reply } }),
      t('replySent', { email: replyTo ?? '' }),
    );

  return (
    <div className={styles.feedbackActions}>
      <form
        className={styles.triageForm}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <SelectField
          label={t('state')}
          options={STATUSES.map((s) => ({ id: s, label: t(`statuses.${s}`) }))}
          selectedKey={nextStatus}
          onSelectionChange={(k) => setNextStatus(k as Status)}
        />
        <TextField
          label={t('note')}
          description={t('noteHint')}
          value={nextNote}
          onChange={setNextNote}
          multiline
          rows={2}
          maxLength={2000}
        />
        <div className="wp-row">
          <Button type="submit" variant="secondary" isBusy={busy === 'save'} isDisabled={!changed}>
            {t('save')}
          </Button>
        </div>
      </form>
      {replyTo ? (
        <Disclosure title={t('writeBack')} headingLevel={4}>
          <form
            className="wp-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <TextField
              label={t('replyLabel')}
              description={t('replyHint', { email: replyTo })}
              value={reply}
              onChange={setReply}
              multiline
              rows={4}
              maxLength={4000}
            />
            <div className="wp-row">
              <Button
                type="submit"
                variant="primary"
                icon="send"
                isBusy={busy === 'reply'}
                isDisabled={reply.trim().length < 2}
              >
                {t('sendReply')}
              </Button>
            </div>
          </form>
        </Disclosure>
      ) : null}
    </div>
  );
}
