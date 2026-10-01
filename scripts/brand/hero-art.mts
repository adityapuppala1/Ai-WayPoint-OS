/**
 * Draws the welcome page's hero as flat SVG: the same route, signs and stations as the 3D
 * scene (apps/web/src/components/landing/route.ts), seen from the camera's resting place and
 * projected with the scene's own camera. The page shows this drawing first, and keeps it
 * wherever the scene is not loaded (less motion, lite mode, data saver, small or slow
 * devices, no WebGL). Run by `pnpm brand`; writes components/landing/hero-art.ts.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GLYPH_BOX } from '../../apps/web/src/components/brand/geometry.ts';
import {
  ART_ASPECT,
  CAMERA,
  DASH_FILL,
  DASH_PERIOD,
  ROUTE_POINTS,
  ROUTE_WIDTH,
  SHADE_RADIUS,
  SIGN_HEIGHT,
  SIGN_OFFSET,
  STATION_RADIUS,
  STOPS,
} from '../../apps/web/src/components/landing/route.ts';
import { ROOT } from './browser.mjs';

// The ES module build, as the web app loads it (the CommonJS one is deprecated).
const THREE = (await import(
  pathToFileURL(join(ROOT, 'apps/web/node_modules/three/build/three.module.js')).href
)) as typeof import('three');
const { CatmullRomCurve3, PerspectiveCamera, Vector3 } = THREE;

/** The drawing's size in SVG units (its aspect is the hero picture's). */
export const W = 500;
export const H = Math.round(W / ART_ASPECT);

const curve = new CatmullRomCurve3(ROUTE_POINTS.map(([x, y, z]) => new Vector3(x, y, z)));
const length = curve.getLength();
const up = new Vector3(0, 1, 0);
const camera = new PerspectiveCamera(CAMERA.fov, ART_ASPECT, 0.1, 120);
camera.position.copy(curve.getPointAt(CAMERA.t));
camera.position.y = CAMERA.height;
const look = curve.getPointAt(CAMERA.t + CAMERA.lookAhead);
look.y = CAMERA.lookHeight;
camera.lookAt(look);
camera.updateMatrixWorld();
camera.updateProjectionMatrix();

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Screen position and distance in front of the camera, or null when behind it. */
function project(p: InstanceType<typeof Vector3>): { x: number; y: number; depth: number } | null {
  const depth = p.clone().applyMatrix4(camera.matrixWorldInverse).z * -1;
  if (depth < 0.4) return null;
  const ndc = p.clone().project(camera);
  return { x: ((ndc.x + 1) / 2) * W, y: ((1 - ndc.y) / 2) * H, depth };
}
/** How much of a thing shows through the fog at this distance (three.js's linear fog). */
const clear = (depth: number) =>
  Math.round(
    Math.min(Math.max(1 - (depth - CAMERA.fogNear) / (CAMERA.fogFar - CAMERA.fogNear), 0), 1) * 100,
  ) / 100;

function edges(t: number) {
  const p = curve.getPointAt(t);
  const side = new Vector3()
    .crossVectors(curve.getTangentAt(t), up)
    .normalize()
    .multiplyScalar(ROUTE_WIDTH / 2);
  return [project(p.clone().sub(side)), project(p.clone().add(side))] as const;
}

/** A strip of the route between two distances, as a closed path, and its distance. */
function strip(from: number, to: number, steps: number) {
  const left: string[] = [];
  const right: string[] = [];
  let depth = 0;
  for (let i = 0; i <= steps; i++) {
    const t = (from + ((to - from) * i) / steps) / length;
    const [a, b] = edges(Math.min(t, 1));
    if (!a || !b) continue;
    left.push(`${r1(a.x)} ${r1(a.y)}`);
    right.unshift(`${r1(b.x)} ${r1(b.y)}`);
    depth = a.depth;
  }
  if (left.length < 2) return null;
  return { d: `M${left.join('L')}L${right.join('L')}Z`, depth };
}

const solidUntil = (STOPS[0]?.t ?? 0) * length;
const solid = strip(0, solidUntil, 80);
const dashes: { d: string; o: number }[] = [];
for (let at = solidUntil; at < length; at += DASH_PERIOD) {
  const piece = strip(at, Math.min(at + DASH_PERIOD * DASH_FILL, length), 3);
  if (!piece) continue;
  const o = clear(piece.depth);
  if (o > 0.02) dashes.push({ d: piece.d, o });
}

const signs: { x: number; y: number; s: number; o: number }[] = [];
const shades: { cx: number; cy: number; rx: number; ry: number; o: number }[] = [];
const stations: { cx: number; cy: number; rx: number; ry: number; o: number; module: string }[] =
  [];
for (const stop of STOPS) {
  const at = curve.getPointAt(stop.t);
  const side = new Vector3().crossVectors(curve.getTangentAt(stop.t), up).normalize();
  const base = at.clone().addScaledVector(side, SIGN_OFFSET * stop.side);
  const foot = project(base);
  const top = project(base.clone().add(new Vector3(0, SIGN_HEIGHT, 0)));
  const sideEdge = project(base.clone().addScaledVector(side, SHADE_RADIUS));
  const depthEdge = project(
    base.clone().add(curve.getTangentAt(stop.t).multiplyScalar(SHADE_RADIUS * 0.6)),
  );
  if (foot && sideEdge && depthEdge) {
    const o = clear(foot.depth);
    if (o > 0.02)
      shades.push({
        cx: r1(foot.x),
        cy: r1(foot.y),
        rx: r1(Math.hypot(sideEdge.x - foot.x, sideEdge.y - foot.y)),
        ry: r1(Math.max(Math.abs(depthEdge.y - foot.y), 0.6)),
        o: Math.round(o * 28) / 100,
      });
  }
  if (foot && top) {
    const o = clear(foot.depth);
    if (o > 0.02) {
      // The glyph's foot (its stem, at x = 19) stands on the projected base point.
      const s = (foot.y - top.y) / GLYPH_BOX.height;
      signs.push({
        x: r1(foot.x - 19 * s),
        y: r1(foot.y - (GLYPH_BOX.y + GLYPH_BOX.height) * s),
        s: Math.round(s * 1000) / 1000,
        o,
      });
    }
  }
  const c = project(at);
  const ex = project(at.clone().addScaledVector(side, STATION_RADIUS));
  const ez = project(at.clone().add(curve.getTangentAt(stop.t).multiplyScalar(STATION_RADIUS)));
  if (c && ex && ez) {
    const o = clear(c.depth);
    if (o > 0.02)
      stations.push({
        cx: r1(c.x),
        cy: r1(c.y),
        rx: r1(Math.hypot(ex.x - c.x, ex.y - c.y)),
        ry: r1(Math.max(Math.abs(ez.y - c.y), 0.6)),
        o,
        module: stop.module,
      });
  }
}

writeFileSync(
  join(ROOT, 'apps/web/src/components/landing/hero-art.ts'),
  `/**
 * The hero drawn flat: the 3D scene's route, signs and stations seen from its camera at rest.
 * Generated by scripts/brand/hero-art.mts (\`pnpm brand\`) from ./route.ts: do not edit by hand.
 * Far things are fainter, as the scene's fog makes them (\`o\` is their opacity).
 */
export const HERO_ART = ${JSON.stringify({ width: W, height: H, solid: solid?.d ?? '', dashes, signs, shades, stations }, null, 2)} as const;
`,
);
console.log(
  `hero art: ${dashes.length} dashes, ${signs.length} signs, ${stations.length} stations`,
);
