/** When the welcome page may draw its 3D hero: only where nothing asks it not to. */
import { describe, expect, it } from 'vitest';
import {
  SCENE_MIN_WIDTH,
  type SceneEnvironment,
  sceneDecision,
} from '../src/components/landing/scene-gate';

const capable: SceneEnvironment = {
  reducedMotion: false,
  lite: false,
  saveData: false,
  effectiveType: '4g',
  webgl: true,
  viewportWidth: 1280,
  deviceMemory: 8,
  cores: 8,
};

describe('the 3D hero', () => {
  it('is drawn on a capable device that asks for nothing less', () => {
    expect(sceneDecision(capable)).toEqual({ draw: true });
    // Browsers that do not say how much memory or how many cores they have are not refused.
    expect(sceneDecision({ ...capable, deviceMemory: undefined, cores: undefined })).toEqual({
      draw: true,
    });
  });

  it.each([
    [{ reducedMotion: true }, 'reduced-motion'],
    [{ lite: true }, 'lite'],
    [{ saveData: true }, 'save-data'],
    [{ effectiveType: '3g' }, 'slow-connection'],
    [{ effectiveType: 'slow-2g' }, 'slow-connection'],
    [{ viewportWidth: SCENE_MIN_WIDTH - 1 }, 'small-screen'],
    [{ deviceMemory: 2 }, 'low-memory'],
    [{ cores: 2 }, 'few-cores'],
    [{ webgl: false }, 'no-webgl'],
  ] as const)('is not drawn when %o', (change, reason) => {
    expect(sceneDecision({ ...capable, ...change })).toEqual({ draw: false, reason });
  });

  it('puts what the person asked for before what the device can do', () => {
    expect(sceneDecision({ ...capable, reducedMotion: true, webgl: false })).toEqual({
      draw: false,
      reason: 'reduced-motion',
    });
    expect(sceneDecision({ ...capable, lite: true, viewportWidth: 320 })).toEqual({
      draw: false,
      reason: 'lite',
    });
  });
});
