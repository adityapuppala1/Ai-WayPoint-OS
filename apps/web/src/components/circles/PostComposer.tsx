'use client';

import type { PostResult } from '@waypoint/api/client';
import { Button, TextField, toast } from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { CrisisCard } from '@/components/support/CrisisCard';
import { api, problemKey } from '@/lib/api';
import styles from './circles.module.css';
import { usePostOutcome } from './usePostOutcome';

const KINDS = ['post', 'win', 'question', 'checkin'] as const;
type Kind = (typeof KINDS)[number];

/** Share an update, a win, a question or a check-in. Checked for safety before anyone sees it. */
export function PostComposer({ circleId }: { circleId: string }) {
  const t = useTranslations('circles');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('post');
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
        json: { kind, body: text },
      });
      setBody('');
      setKind('post');
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
      <form className={styles.form} onSubmit={submit}>
        <RadioGroup
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          className={styles.kinds}
          orientation="horizontal"
        >
          <Label className={styles.kindsLabel}>{t('kindLabel')}</Label>
          <div className={styles.chips}>
            {KINDS.map((k) => (
              <Radio key={k} value={k} className={styles.chip}>
                {t(`kinds.${k}`)}
              </Radio>
            ))}
          </div>
        </RadioGroup>
        <TextField
          label={t(`bodyLabels.${kind}`)}
          description={t('bodyHint')}
          value={body}
          onChange={setBody}
          multiline
          rows={4}
          maxLength={2000}
        />
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            icon="send"
            isBusy={busy}
            isDisabled={!body.trim()}
          >
            {t('send')}
          </Button>
        </div>
      </form>
    </>
  );
}
