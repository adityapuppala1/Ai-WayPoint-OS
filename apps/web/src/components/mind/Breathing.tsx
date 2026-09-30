'use client';

import { Button } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import styles from './mind.module.css';

/** In 4 · hold 4 · out 6 — the same rhythm as the grounding card on Get help now. */
const PHASES = [
  { id: 'in', seconds: 4 },
  { id: 'hold', seconds: 4 },
  { id: 'out', seconds: 6 },
] as const;
const ROUNDS = 5;

type Phase = (typeof PHASES)[number]['id'] | 'idle' | 'done';

/** A guided breathing circle. Words carry every cue, so it works without motion or sight. */
export function Breathing() {
  const t = useTranslations('mind');
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [seconds, setSeconds] = useState(4);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (r: number, i: number) => {
    const p = PHASES[i];
    if (!p) {
      if (r >= ROUNDS) {
        setPhase('done');
        return;
      }
      run(r + 1, 0);
      return;
    }
    setRound(r);
    setPhase(p.id);
    setSeconds(p.seconds);
    timer.current = setTimeout(() => run(r, i + 1), p.seconds * 1000);
  };

  const start = () => {
    clearTimeout(timer.current);
    run(1, 0);
  };
  const stop = () => {
    clearTimeout(timer.current);
    setPhase('idle');
  };

  const cue =
    phase === 'in'
      ? t('breatheIn')
      : phase === 'hold'
        ? t('breatheHold')
        : phase === 'out'
          ? t('breatheOut')
          : phase === 'done'
            ? t('breatheDone')
            : t('breatheLead');
  const running = phase === 'in' || phase === 'hold' || phase === 'out';

  return (
    <div className={styles.breathe}>
      <div className={styles.circleWrap} aria-hidden="true">
        <div
          className={styles.circle}
          data-phase={running ? phase : 'out'}
          style={{ transitionDuration: running ? `${seconds}s` : '0.6s' }}
        />
      </div>
      <p className={styles.cue} aria-live="polite">
        {cue}
      </p>
      {running ? <p className="wp-meta">{t('breatheRound', { round, total: ROUNDS })}</p> : null}
      <div className={styles.actions}>
        {running ? (
          <Button onPress={stop} icon="stop">
            {t('breatheStop')}
          </Button>
        ) : (
          <Button onPress={start} variant="primary" icon="forward">
            {t('breatheStart')}
          </Button>
        )}
      </div>
    </div>
  );
}
