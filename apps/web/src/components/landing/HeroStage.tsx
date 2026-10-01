'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { HeroScene } from './hero-scene';
import styles from './landing.module.css';
import { readEnvironment, sceneDecision } from './scene-gate';

type Stage = 'static' | 'loading' | 'live';

/**
 * The hero's picture. The drawing (`children`, from the server) is always there first. Once
 * the page is usable and the browser is idle, and only where scene-gate.ts allows it, the 3D
 * scene is fetched (its own chunk, never in the page's first script) and fades in over the
 * drawing. If the person then asks for less motion or turns on lite mode, or the browser
 * takes the GPU back, the scene is thrown away and the drawing stays.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>('static');

  useEffect(() => {
    const layer = host.current;
    if (!layer) return;
    let cancelled = false;
    let scene: HeroScene | undefined;
    const stop = () => {
      scene?.dispose();
      scene = undefined;
      if (!cancelled) setStage('static');
    };
    const start = () => {
      if (cancelled) return;
      const decision = sceneDecision(readEnvironment());
      layer.dataset.decision = decision.draw ? 'draw' : decision.reason;
      if (!decision.draw) return;
      setStage('loading');
      import('./hero-scene')
        .then(({ mountHeroScene }) => {
          if (cancelled) return;
          scene = mountHeroScene(layer, {
            onReady: () => {
              if (!cancelled) setStage('live');
            },
            onLost: stop,
          });
        })
        .catch(() => {
          // A chunk that failed to load leaves the drawing, which is the whole picture.
          if (!cancelled) setStage('static');
        });
    };

    // After the page answers to input, when the browser has nothing better to do.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 2500 })
      : window.setTimeout(start, 1200);

    // Asking for less motion, or lite mode, later on: the scene goes at once.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      if (motion.matches) stop();
    };
    const lite = new MutationObserver(() => {
      if (document.documentElement.getAttribute('data-lite') === 'true') stop();
    });
    motion.addEventListener('change', onMotion);
    lite.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lite'] });

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      motion.removeEventListener('change', onMotion);
      lite.disconnect();
      scene?.dispose();
    };
  }, []);

  return (
    <div className={styles.stage} data-scene={stage}>
      <div className={styles.art}>{children}</div>
      <div ref={host} className={styles.canvasLayer} aria-hidden="true" />
    </div>
  );
}
