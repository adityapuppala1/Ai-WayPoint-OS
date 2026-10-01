/**
 * Whether the welcome page may draw its 3D hero. Plain module (no 'use client') so the rule
 * can be tested on its own (test/scene-gate.test.ts).
 *
 * The scene is decoration: the page says everything without it, and the drawing it replaces
 * is already on the page. So it is only fetched where it costs the person nothing they would
 * notice, and never where they asked for less: any "no" below keeps the drawing.
 */
export interface SceneEnvironment {
  /** `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
  /** Lite mode (`data-lite="true"` on <html>): no motion, fewer requests. */
  lite: boolean;
  /** The browser's data saver (`navigator.connection.saveData`). */
  saveData: boolean;
  /** `navigator.connection.effectiveType`, where the browser says ("slow-2g" … "4g"). */
  effectiveType?: string;
  /** Whether a WebGL context could be made. */
  webgl: boolean;
  /** The width of the page, in CSS pixels. */
  viewportWidth: number;
  /** `navigator.deviceMemory` in GB, where the browser says (Chromium only). */
  deviceMemory?: number;
  /** `navigator.hardwareConcurrency`, where the browser says. */
  cores?: number;
}

export type SceneDecision =
  | { draw: true }
  | {
      draw: false;
      reason:
        | 'reduced-motion'
        | 'lite'
        | 'save-data'
        | 'slow-connection'
        | 'no-webgl'
        | 'small-screen'
        | 'low-memory'
        | 'few-cores';
    };

/** The narrowest page that gets the scene: the hero is two columns from here (48rem). */
export const SCENE_MIN_WIDTH = 768;

export function sceneDecision(env: SceneEnvironment): SceneDecision {
  if (env.reducedMotion) return { draw: false, reason: 'reduced-motion' };
  if (env.lite) return { draw: false, reason: 'lite' };
  if (env.saveData) return { draw: false, reason: 'save-data' };
  if (env.effectiveType && /(^|-)2g$|^3g$/.test(env.effectiveType))
    return { draw: false, reason: 'slow-connection' };
  if (env.viewportWidth < SCENE_MIN_WIDTH) return { draw: false, reason: 'small-screen' };
  if (env.deviceMemory !== undefined && env.deviceMemory < 4)
    return { draw: false, reason: 'low-memory' };
  if (env.cores !== undefined && env.cores < 4) return { draw: false, reason: 'few-cores' };
  if (!env.webgl) return { draw: false, reason: 'no-webgl' };
  return { draw: true };
}

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** Reads the environment from the browser. WebGL is tried last, and only if it matters. */
export function readEnvironment(): SceneEnvironment {
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    deviceMemory?: number;
  };
  const base: SceneEnvironment = {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    lite: document.documentElement.getAttribute('data-lite') === 'true',
    saveData: Boolean(nav.connection?.saveData),
    effectiveType: nav.connection?.effectiveType,
    viewportWidth: document.documentElement.clientWidth,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency || undefined,
    webgl: true,
  };
  // Only make a test context when nothing else has said no: it is not free.
  if (!sceneDecision(base).draw) return base;
  return { ...base, webgl: canUseWebGL() };
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
