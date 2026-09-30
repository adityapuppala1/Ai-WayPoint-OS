/**
 * The toast queue: how long a toast stays, and that closing one lets it animate out before
 * it is removed. (What a toast looks like in a browser is checked in apps/web/e2e/design.spec.ts.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, toastQueue } from '../src';

const timeoutOf = (key: string) => toastQueue.visibleToasts.find((t) => t.key === key)?.timeout;

afterEach(() => {
  vi.unstubAllGlobals();
  toastQueue.clear();
});

describe('toast', () => {
  it('stays five seconds by default, or as long as the caller asks', () => {
    expect(timeoutOf(toast({ title: 'Saved' }))).toBe(5000);
    expect(timeoutOf(toast({ title: 'Saved' }, 3000))).toBe(3000);
  });

  it('stays at least ten seconds when it offers an action, so there is time to reach it', () => {
    const action = { label: 'Undo', onAction: () => {} };
    expect(timeoutOf(toast({ title: 'Marked as done', action }))).toBe(10_000);
    // A shorter time asked for by the caller does not take the chance to undo away.
    expect(timeoutOf(toast({ title: 'Marked as done', action }, 3000))).toBe(10_000);
    expect(timeoutOf(toast({ title: 'Marked as done', action }, 20_000))).toBe(20_000);
  });

  it('keeps the action with the toast', () => {
    const onAction = vi.fn();
    const key = toast({ title: 'Deleted', tone: 'safe', action: { label: 'Undo', onAction } });
    const shown = toastQueue.visibleToasts.find((t) => t.key === key);
    expect(shown?.content.action?.label).toBe('Undo');
    shown?.content.action?.onAction();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('removes a toast at once when there is nothing on screen to animate', () => {
    const key = toast({ title: 'Saved' });
    toastQueue.close(key);
    expect(toastQueue.visibleToasts.map((t) => t.key)).not.toContain(key);
  });

  it('lets a toast on screen animate out before removing it', async () => {
    // A stand-in for the toast's element: marked as leaving, with one animation still running.
    let finish: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const attributes: Record<string, string> = {};
    const element = {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
      getAnimations: () => [{ finished }],
    };
    const key = toast({ title: 'Saved' });
    vi.stubGlobal('document', {
      querySelector: (selector: string) => (selector.includes(key) ? element : null),
    });
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'toastOut' }));

    toastQueue.close(key);
    expect(attributes['data-exiting']).toBe('true');
    expect(toastQueue.visibleToasts.map((t) => t.key)).toContain(key);
    // Closing it again while it leaves changes nothing.
    toastQueue.close(key);
    expect(toastQueue.visibleToasts.map((t) => t.key)).toContain(key);

    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toastQueue.visibleToasts.map((t) => t.key)).not.toContain(key);
  });

  it('removes a toast anyway if its exit animation never finishes', () => {
    vi.useFakeTimers();
    try {
      const element = {
        setAttribute: () => {},
        // For example an animation paused in a background tab.
        getAnimations: () => [{ finished: new Promise<void>(() => {}) }],
      };
      const key = toast({ title: 'Saved' });
      vi.stubGlobal('document', { querySelector: () => element });
      vi.stubGlobal('getComputedStyle', () => ({ animationName: 'toastOut' }));
      toastQueue.close(key);
      expect(toastQueue.visibleToasts.map((t) => t.key)).toContain(key);
      vi.advanceTimersByTime(1000);
      expect(toastQueue.visibleToasts.map((t) => t.key)).not.toContain(key);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes a toast at once when motion is off and nothing animates', () => {
    const attributes: Record<string, string> = {};
    const element = {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
      getAnimations: () => [],
    };
    const key = toast({ title: 'Saved' });
    vi.stubGlobal('document', { querySelector: () => element });
    vi.stubGlobal('getComputedStyle', () => ({ animationName: 'none' }));
    toastQueue.close(key);
    expect(toastQueue.visibleToasts.map((t) => t.key)).not.toContain(key);
  });
});
