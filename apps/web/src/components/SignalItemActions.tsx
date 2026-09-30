'use client';

import { Button, toast } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { api, problemKey } from '@/lib/api';
import styles from './SignalItem.module.css';

/**
 * One signal with the two things a person can do about it: keep it ("Save") or say it is not
 * for them ("Not relevant"). Both can be taken back on the spot: Save is a switch, and a
 * hidden signal leaves a line with "Undo" where it was until the page is left.
 *
 * The words come in as props: the `signals` messages stay on the server.
 */
export function SignalItemActions({
  id,
  title,
  saved: wasSaved,
  canDismiss = true,
  labels,
  children,
}: {
  id: string;
  /** Names the signal in each button's accessible name, so the buttons can be told apart. */
  title: string;
  saved: boolean;
  /** Off on the Saved list: what someone chose to keep is not offered for hiding there. */
  canDismiss?: boolean;
  labels: { save: string; saved: string; dismiss: string; hidden: string; undo: string };
  children: ReactNode;
}) {
  const errors = useTranslations('errors');
  const [saved, setSaved] = useState(wasSaved);
  const [hidden, setHidden] = useState(false);
  /** Changes go to the server one after another, in the order they were pressed. */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const hiddenId = useId();
  const row = useRef<HTMLDivElement>(null);
  /** Set when hiding or un-hiding was asked for with a button, so focus follows it. */
  const follow = useRef(false);

  // The button that was pressed has gone: move focus to the one that takes its place
  // ("Undo", or "Not relevant" again), so a keyboard is never left nowhere.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the row changes
  useEffect(() => {
    if (!follow.current) return;
    follow.current = false;
    const buttons = row.current?.querySelectorAll('button');
    buttons?.[buttons.length - 1]?.focus();
  }, [hidden]);

  const send = (json: Record<string, unknown>, undo: () => void) => {
    queue.current = queue.current.then(async () => {
      try {
        await api(`/api/signals/${id}/state`, { json });
      } catch (err) {
        undo();
        toast({ title: errors(problemKey(err)), tone: 'danger' });
      }
    });
  };

  const toggleSaved = () => {
    const next = !saved;
    setSaved(next);
    send({ saved: next }, () => setSaved(!next));
  };
  const hide = (next: boolean) => {
    follow.current = true;
    setHidden(next);
    send(next ? { dismissed: true, feedback: 'not-relevant' } : { dismissed: false }, () =>
      setHidden(!next),
    );
  };

  if (hidden)
    return (
      <div className={styles.item} data-hidden="true">
        <div className={styles.hidden} ref={row}>
          <p id={hiddenId}>
            {labels.hidden} <span className="wp-visually-hidden">{title}</span>
          </p>
          <Button variant="quiet" aria-describedby={hiddenId} onPress={() => hide(false)}>
            {labels.undo}
          </Button>
        </div>
      </div>
    );

  return (
    <article className={styles.item}>
      {children}
      <div className={styles.actions} ref={row}>
        <Button
          variant="quiet"
          className={styles.action}
          icon={saved ? 'check' : undefined}
          aria-pressed={saved}
          aria-label={`${saved ? labels.saved : labels.save}: ${title}`}
          onPress={toggleSaved}
        >
          {saved ? labels.saved : labels.save}
        </Button>
        {canDismiss ? (
          <Button
            variant="quiet"
            className={styles.action}
            icon="hide"
            aria-label={`${labels.dismiss}: ${title}`}
            onPress={() => hide(true)}
          >
            {labels.dismiss}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
