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

export interface ToastAction {
  /** A verb, translated by the app: "Undo". */
  label: string;
  /** Runs when the person presses the action; the toast then closes. */
  onAction: () => void;
}

export interface ToastContentValue {
  title: string;
  description?: string;
  tone?: 'info' | 'safe' | 'caution' | 'danger';
  /** One thing the person can do about what just happened, usually taking it back. */
  action?: ToastAction;
}

const TONE_ICON: Record<NonNullable<ToastContentValue['tone']>, IconName> = {
  info: 'info',
  safe: 'safe',
  caution: 'caution',
  danger: 'danger',
};

/** Long enough to read a line. */
const TIMEOUT = 5000;
/** Long enough to read it, find the action and reach it, by keyboard or screen reader too. */
const ACTION_TIMEOUT = 10_000;

/**
 * The queue, with one addition: a toast that is on screen animates out before it is removed.
 * Closing marks its element as leaving and waits for the exit animation in the stylesheet.
 * Where nothing animates (lite mode, reduced motion, a toast that is not on screen) it is
 * removed at once.
 */
class AnimatedToastQueue extends ToastQueue<ToastContentValue> {
  private leaving = new Set<string>();

  override close(key: string): void {
    if (this.leaving.has(key)) return;
    const element =
      typeof document === 'undefined'
        ? null
        : document.querySelector<HTMLElement>(`[data-toast="${key}"]`);
    if (!element || typeof element.getAnimations !== 'function') {
      super.close(key);
      return;
    }
    element.setAttribute('data-exiting', 'true');
    // Reading a computed style makes the browser apply the exit animation before we ask for it.
    void getComputedStyle(element).animationName;
    const running = element.getAnimations();
    if (running.length === 0) {
      super.close(key);
      return;
    }
    this.leaving.add(key);
    const remove = () => {
      if (!this.leaving.delete(key)) return;
      clearTimeout(giveUp);
      super.close(key);
    };
    // The exit takes 120ms. If the animation never reports its end (a paused or background
    // tab), the toast must still go.
    const giveUp = setTimeout(remove, 1000);
    Promise.all(running.map((animation) => animation.finished)).then(remove, remove);
  }

  override clear(): void {
    this.leaving.clear();
    super.clear();
  }
}

export const toastQueue = new AnimatedToastQueue({
  maxVisibleToasts: 3,
  // Keep DOM updates synchronous so screen readers announce reliably.
  wrapUpdate(fn) {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      flushSync(fn);
    } else {
      fn();
    }
  },
});

/**
 * Confirms an action the person just took, using the same verb as the button ("Saved",
 * "Published"). With an `action` it also offers one way to respond, usually "Undo", and
 * stays at least ten seconds so there is time to reach it.
 */
export function toast(content: ToastContentValue, timeout?: number) {
  const stay = content.action ? Math.max(timeout ?? 0, ACTION_TIMEOUT) : (timeout ?? TIMEOUT);
  return toastQueue.add(content, { timeout: stay });
}

export function Toaster({ closeLabel = 'Dismiss' }: { closeLabel?: string }) {
  return (
    <ToastRegion queue={toastQueue} className={styles.region}>
      {({ toast: t }) => {
        const action = t.content.action;
        return (
          <AriaToast toast={t} className={styles.toast} data-toast={t.key}>
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
              {/* Read out with the message, so a screen reader user hears that there is an
                  action; the button itself sits beside the message for everyone. */}
              {action ? <span className="wp-visually-hidden">{action.label}</span> : null}
            </ToastContent>
            {action ? (
              <AriaButton
                className={styles.action}
                onPress={() => {
                  action.onAction();
                  toastQueue.close(t.key);
                }}
              >
                {action.label}
              </AriaButton>
            ) : null}
            <AriaButton slot="close" aria-label={closeLabel} className={styles.close}>
              <Icon name="close" size={18} />
            </AriaButton>
          </AriaToast>
        );
      }}
    </ToastRegion>
  );
}
