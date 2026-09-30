'use client';

import type { CrisisResponsePlan } from '@waypoint/core';
import { Button, Icon, type IconName, LinkButton } from '@waypoint/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isolateNumbers } from '@/lib/bidi';
import styles from './crisis.module.css';

const ICON: Record<string, IconName> = {
  emergency: 'phone',
  call: 'phone',
  text: 'text',
  chat: 'ask',
  web: 'web',
  'trusted-contact': 'account',
  grounding: 'mind',
  circle: 'circles',
  stay: 'check',
};

/**
 * The calm harbour: support first, in the person's language, with real local numbers.
 * Blue (support), never alarm red.
 */
export function CrisisCard({ plan, onStay }: { plan: CrisisResponsePlan; onStay?: () => void }) {
  const t = useTranslations('support');
  const [grounding, setGrounding] = useState(false);
  const primary = plan.actions.filter(
    (a) => a.href && (a.kind === 'emergency' || a.kind === 'call' || a.kind === 'text'),
  );
  const secondary = plan.actions.filter((a) => !primary.includes(a));

  return (
    <section className={styles.card} aria-labelledby="crisis-headline" lang={plan.locale}>
      <div className={styles.head}>
        <span className={styles.mark} aria-hidden>
          <Icon name="support" size={22} weight="fill" />
        </span>
        <h2 id="crisis-headline" className={styles.headline}>
          {plan.headline}
        </h2>
      </div>
      <p className={styles.message}>{plan.message}</p>

      {primary.length ? (
        <div className={styles.primary}>
          {primary.map((a, i) => (
            <LinkButton
              key={`${a.kind}-${i}`}
              href={a.href ?? '#'}
              variant={i === 0 ? 'support' : 'secondary'}
              size="lg"
              icon={ICON[a.kind] ?? 'phone'}
            >
              {isolateNumbers(a.label)}
            </LinkButton>
          ))}
        </div>
      ) : null}

      {secondary.length ? (
        <ul className={styles.secondary}>
          {secondary.map((a, i) => (
            <li key={`${a.kind}-${i}`}>
              {a.kind === 'grounding' ? (
                <Button
                  variant="quiet"
                  icon="mind"
                  onPress={() => setGrounding((g) => !g)}
                  aria-expanded={grounding}
                >
                  {a.label}
                </Button>
              ) : a.kind === 'stay' ? (
                <Button variant="quiet" icon="check" onPress={onStay}>
                  {a.label}
                </Button>
              ) : a.kind === 'trusted-contact' ? (
                <Link href={'/settings/privacy#trusted' as Route} className={styles.link}>
                  <Icon name="account" size={18} />
                  {a.label}
                </Link>
              ) : a.kind === 'circle' ? (
                <Link href={'/circles' as Route} className={styles.link}>
                  <Icon name="circles" size={18} />
                  {a.label}
                </Link>
              ) : a.href ? (
                <a
                  href={a.href}
                  className={styles.link}
                  target={a.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                >
                  <Icon name={ICON[a.kind] ?? 'web'} size={18} />
                  {isolateNumbers(a.label)}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {grounding ? (
        <div className={styles.grounding} aria-live="polite">
          <p className={styles.groundingTitle}>{t('groundingTitle')}</p>
          <p>{t('groundingBody')}</p>
          <span className={styles.breath} aria-hidden />
        </div>
      ) : null}

      <p className={styles.foot}>
        <Link href={'/support' as Route}>{t('title')}</Link>
      </p>
    </section>
  );
}
