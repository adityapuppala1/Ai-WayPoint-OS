/**
 * The welcome page's hero: a route through open ground, with the Waypoint mark standing at
 * each stop like a sign beside the road. One description serves the 3D scene
 * (hero-scene.ts) and the drawing shown instead of it (HeroArt.tsx, made from this by
 * `pnpm brand`), so the two are the same picture.
 *
 * World units are metres, more or less: the route lies on the ground (y = 0) and runs away
 * from the camera towards -z. Plain data, no three.js, so the server and the script can read it.
 */
import type { ModuleKey } from '@waypoint/ui';

/** Control points of the route's centre line (a Catmull-Rom curve through them). */
export const ROUTE_POINTS: readonly (readonly [number, number, number])[] = [
  [-1.2, 0, 9],
  [0.4, 0, 4],
  [2.6, 0, -1],
  [3.4, 0, -6],
  [1.0, 0, -11],
  [-2.8, 0, -16],
  [-4.2, 0, -22],
  [-1.4, 0, -28],
  [3.2, 0, -34],
  [5.0, 0, -41],
  [1.6, 0, -49],
  [-3.0, 0, -58],
  [-1.0, 0, -70],
];

/** Width of the route line. */
export const ROUTE_WIDTH = 0.42;

/** Behind the first stop the line is solid; ahead of it, dashed, as Route draws a plan. */
export const DASH_PERIOD = 0.8;
export const DASH_FILL = 0.5;

/**
 * The stops: where along the route (0 = start, 1 = end), which side of the road the sign
 * stands on, and the module line colour of the station dot under it.
 */
export const STOPS: readonly { t: number; side: 1 | -1; module: ModuleKey }[] = [
  { t: 0.1, side: 1, module: 'today' },
  { t: 0.19, side: -1, module: 'path' },
  { t: 0.31, side: 1, module: 'shield' },
  { t: 0.44, side: -1, module: 'money' },
  { t: 0.58, side: 1, module: 'mind' },
  { t: 0.73, side: -1, module: 'circles' },
  { t: 0.88, side: 1, module: 'support' },
];

/** How far from the centre line a sign stands. */
export const SIGN_OFFSET = 0.95;
/** Height of a sign (the mark's ink, foot to the top of the dot). */
export const SIGN_HEIGHT = 1.5;
/** Radius of the patch of shade under a sign. */
export const SHADE_RADIUS = 0.42;
/** Radius of a station dot. */
export const STATION_RADIUS = 0.3;

/** Where the camera rests: on the route at `t`, `height` up, looking `lookAhead` further on. */
export const CAMERA = {
  fov: 36,
  t: 0.0,
  height: 3.4,
  lookAhead: 0.16,
  lookHeight: 0,
  /** How far along the route the camera travels while the hero scrolls out of view. */
  travel: 0.2,
  /** Fog: everything fades into the hero's background between these distances. */
  fogNear: 10,
  fogFar: 52,
} as const;

/** The camera's aspect ratio for the static drawing: the hero's picture box. */
export const ART_ASPECT = 5 / 4;
