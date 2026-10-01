'use client';

import {
  Button,
  Checkbox,
  Notice,
  Radio,
  RadioGroup,
  SelectField,
  type SelectOption,
  TextField,
} from '@waypoint/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api, problemKey } from '@/lib/api';
import styles from './feedback.module.css';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * "Tell us what worked, or what didn't": which part of Waypoint, how well it worked (if the
 * person wants to say), and their words. It sends only those things. Personal details are
 * taken out of the message by the server before it is kept, and the people who read it are
 * not shown who wrote it unless the person asks for a reply.
 */
export function FeedbackForm({
  modules,
  about,
  replyTo,
}: {
  /** The parts of Waypoint feedback can be about, already named. */
  modules: SelectOption[];
  /** The part to start on (from the link that led here), when there is one. */
  about: string;
  /** The address a reply would go to. Null for guests and phone accounts: no offer is made. */
  replyTo: string | null;
}) {
  const t = useTranslations('settings');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const [module, setModule] = useState(about);
  const [rating, setRating] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [wantsReply, setWantsReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSent(false);
    // An empty note would tell nobody anything.
    if (!message.trim() && !rating) {
      setError(t('feedbackNeed'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/api/feedback', {
        json: {
          module,
          ...(rating ? { rating: Number(rating) } : {}),
          ...(message.trim() ? { message: message.trim() } : {}),
          ...(replyTo && wantsReply ? { wantsReply: true } : {}),
        },
      });
      // Cleared, so the same words are not sent twice; the form stays for anything else.
      setMessage('');
      setRating(null);
      setWantsReply(false);
      setSent(true);
    } catch (err) {
      setError(errors(problemKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <SelectField
        label={t('feedbackAbout')}
        options={modules}
        selectedKey={module}
        onSelectionChange={(key) => setModule(String(key))}
        isRequired
      />
      <RadioGroup
        label={t('feedbackRating')}
        description={t('feedbackRatingHint')}
        optionalLabel={common('optional')}
        orientation="horizontal"
        className={styles.ratings}
        value={rating}
        onChange={(value) => {
          setRating(value);
          // "Choose a number first" has been answered.
          setError(null);
        }}
      >
        {RATINGS.map((r) => (
          <Radio key={r} value={String(r)}>
            {format.number(r)}
          </Radio>
        ))}
      </RadioGroup>
      <TextField
        label={t('feedbackMessage')}
        description={t('feedbackMessageHint')}
        optionalLabel={common('optional')}
        multiline
        rows={5}
        value={message}
        onChange={(value) => {
          setMessage(value);
          setError(null);
        }}
        maxLength={2000}
      />
      {replyTo ? (
        <Checkbox
          isSelected={wantsReply}
          onChange={setWantsReply}
          description={t('feedbackReplyHint', { email: replyTo })}
        >
          {t('feedbackReply')}
        </Checkbox>
      ) : null}
      {error ? <Notice tone="danger" role="alert" title={error} /> : null}
      <div className={styles.end}>
        {/* Always here, so the thank-you is announced when it appears inside it. */}
        <div aria-live="polite">
          {sent ? <Notice tone="safe" title={t('feedbackSent')} /> : null}
        </div>
        <div className="wp-row">
          <Button type="submit" variant="primary" icon="send" isBusy={busy}>
            {t('feedbackSend')}
          </Button>
        </div>
      </div>
    </form>
  );
}
