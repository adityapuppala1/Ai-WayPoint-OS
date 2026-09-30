'use client';

import {
  Button as AriaButton,
  UNSTABLE_Toast as AriaToast,
  Text,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { flushSync } from 'react-dom';
import type { IconName } from '../icons';
import { Icon } from './Icon';
import styles from './Toast.module.css';

export interface ToastContentValue {
  title: string;
  description?: string;
  tone?: 'info' | 'safe' | 'caution' | 'danger';
}

const TONE_ICON: Record<NonNullable<ToastContentValue['tone']>, IconName> = {
  info: 'info',
  safe: 'safe',
  caution: 'caution',
  danger: 'danger',
};

export const toastQueue = new ToastQueue<ToastContentValue>({
  maxVisibleToasts: 3,
  // Keep DOM updates synchronous so screen readers announce reliably.
  wrapUpdate(fn) {
    if ('startViewTransition' in document) {
      flushSync(fn);
    } else {
      fn();
    }
  },
});

/** Confirms an action the person just took, using the same verb as the button ("Saved", "Published"). */
export function toast(content: ToastContentValue, timeout = 5000) {
  return toastQueue.add(content, { timeout });
}

export function Toaster({ closeLabel = 'Dismiss' }: { closeLabel?: string }) {
  return (
    <ToastRegion queue={toastQueue} className={styles.region}>
      {({ toast: t }) => (
        <AriaToast toast={t} className={styles.toast}>
          <span className={styles.icon}>
            <Icon name={TONE_ICON[t.content.tone ?? 'info']} size={20} weight="fill" />
          </span>
          <ToastContent className={styles.content}>
            <Text slot="title" className={styles.title}>
              {t.content.title}
            </Text>
            {t.content.description ? (
              <Text slot="description" className={styles.description}>
                {t.content.description}
              </Text>
            ) : null}
          </ToastContent>
          <AriaButton slot="close" aria-label={closeLabel} className={styles.close}>
            <Icon name="close" size={18} />
          </AriaButton>
        </AriaToast>
      )}
    </ToastRegion>
  );
}
