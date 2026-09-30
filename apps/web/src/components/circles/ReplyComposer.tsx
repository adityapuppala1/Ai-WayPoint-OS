'use client';

import type { PostResult } from '@waypoint/api/client';
import { Button, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { CrisisCard } from '@/components/support/CrisisCard';
import { api, problemKey } from '@/lib/api';
import styles from './circles.module.css';
import { usePostOutcome } from './usePostOutcome';

/** A reply, one level deep. Opens in place so the conversation stays in view. */
export function ReplyComposer({
  circleId,
  postId,
  authorName,
}: {
  circleId: string;
  postId: string;
  authorName: string;
}) {
  const t = useTranslations('circles');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const outcome = usePostOutcome();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await api<PostResult>(`/api/circles/${circleId}/posts`, {
        json: { body: text, parentId: postId },
      });
      setBody('');
      setOpen(false);
      outcome.report(res, t('posted'));
      router.refresh();
    } catch (err) {
      toast({ title: errors(problemKey(err)), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {outcome.crisis ? <CrisisCard plan={outcome.crisis} onStay={outcome.clearCrisis} /> : null}
      {open ? (
        <form className={styles.replyForm} onSubmit={submit}>
          <TextField
            label={t('replyTo', { name: authorName })}
            value={body}
            onChange={setBody}
            multiline
            rows={2}
            maxLength={2000}
            autoFocus
          />
          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon="send"
              isBusy={busy}
              isDisabled={!body.trim()}
            >
              {t('sendReply')}
            </Button>
            <Button variant="quiet" size="sm" onPress={() => setOpen(false)} isDisabled={busy}>
              {common('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button
            variant="quiet"
            size="sm"
            icon="reply"
            onPress={() => setOpen(true)}
            aria-label={t('replyTo', { name: authorName })}
          >
            {t('reply')}
          </Button>
        </div>
      )}
    </>
  );
}
