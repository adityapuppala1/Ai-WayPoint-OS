/**
 * The welcome page's 3D hero: the route of route.ts with a Waypoint mark standing at each
 * stop. Loaded only by HeroStage, with a dynamic import, after the page is usable and only
 * where scene-gate.ts says yes; it is never part of the page's first script.
 *
 * It moves only when something happens: once as it arrives (the signs stand up, the camera
 * settles), then as the person scrolls (the camera travels a little way along the route,
 * scrubbed by the scroll position, no easing) and, with a mouse, a slight turn towards the
 * pointer. Nothing loops: between those moments no frame is drawn at all. Off screen or in a
 * hidden tab it draws nothing either.
 */
import { hexRoles, nativeTheme } from '@waypoint/tokens';
import type { ModuleKey } from '@waypoint/ui';
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DOT, GLYPH_BOX, SIGN, STEM } from '../brand/geometry';
import {
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
} from './route';

export interface HeroScene {
  dispose(): void;
}

interface Options {
  /** The first frame is on the canvas. */
  onReady(): void;
  /** The browser took the GPU back: the page shows the drawing again. */
  onLost(): void;
}

type Mode = 'light' | 'dark';

/** The theme the page is showing: the saved choice, else the device's. */
function currentMode(): Mode {
  const chosen = document.documentElement.getAttribute('data-theme');
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Colours from the design tokens. The background matches the hero band's CSS. */
function palette(mode: Mode) {
  const roles = hexRoles(mode);
  const lines = nativeTheme(mode).modules;
  const line = (m: ModuleKey) =>
    m === 'support' ? roles.support : (lines[m as keyof typeof lines]?.line ?? roles.signal);
  return {
    background: mode === 'light' ? roles.sign : roles.sunken,
    signal: roles.signal,
    route: roles.signMuted,
    line,
  };
}

const easeOut = (x: number) => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3;

export function mountHeroScene(host: HTMLElement, options: Options): HeroScene {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-hero-canvas', '');
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 120);
  const curve = new CatmullRomCurve3(ROUTE_POINTS.map(([x, y, z]) => new Vector3(x, y, z)));
  const length = curve.getLength();
  const up = new Vector3(0, 1, 0);

  // --- Materials, recoloured when the theme changes ---------------------------------------
  let colours = palette(currentMode());
  const fog = new Fog(colours.background, CAMERA.fogNear, CAMERA.fogFar);
  scene.fog = fog;
  const signMaterial = new MeshLambertMaterial({ color: colours.signal });
  const routeMaterial = new MeshBasicMaterial({ color: colours.route, side: DoubleSide });
  // A soft patch of shade where each sign stands, so it stands on the ground.
  const shadeMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  // Solid behind the first stop, dashed ahead of it: fragments in a dash's gap are dropped.
  const solidUntil = { value: (STOPS[0]?.t ?? 0) * length };
  routeMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uSolidUntil = solidUntil;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float along;\nvarying float vAlong;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = along;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uSolidUntil;\nvarying float vAlong;',
      )
      .replace(
        'void main() {',
        `void main() {\n  if (vAlong > uSolidUntil && fract(vAlong / ${DASH_PERIOD.toFixed(3)}) > ${DASH_FILL.toFixed(3)}) discard;`,
      );
  };
  const stationMaterials = new Map<ModuleKey, MeshBasicMaterial>();
  const stationMaterial = (m: ModuleKey) => {
    let found = stationMaterials.get(m);
    if (!found) {
      found = new MeshBasicMaterial({ color: colours.line(m) });
      stationMaterials.set(m, found);
    }
    return found;
  };

  // --- The route: a flat ribbon along the curve ------------------------------------------
  {
    const samples = 700;
    const points = curve.getSpacedPoints(samples);
    const positions = new Float32Array((samples + 1) * 2 * 3);
    const along = new Float32Array((samples + 1) * 2);
    const indices: number[] = [];
    const side = new Vector3();
    for (let i = 0; i <= samples; i++) {
      const p = points[i] as Vector3;
      const tangent = curve.getTangentAt(i / samples);
      side
        .crossVectors(tangent, up)
        .normalize()
        .multiplyScalar(ROUTE_WIDTH / 2);
      positions.set([p.x - side.x, 0.004, p.z - side.z, p.x + side.x, 0.004, p.z + side.z], i * 6);
      const distance = (i / samples) * length;
      along[i * 2] = distance;
      along[i * 2 + 1] = distance;
      if (i < samples) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('along', new BufferAttribute(along, 1));
    geometry.setIndex(indices);
    scene.add(new Mesh(geometry, routeMaterial));
  }

  // --- The signs: the Waypoint mark, standing --------------------------------------------
  // Glyph units to metres: the ink is SIGN_HEIGHT tall; its foot stands on the ground.
  const k = SIGN_HEIGHT / GLYPH_BOX.height;
  const foot = GLYPH_BOX.y + GLYPH_BOX.height;
  const stemX = DOT.cx;
  const gx = (x: number) => (x - stemX) * k;
  const gy = (y: number) => (foot - y) * k;
  const stemTop = 24;
  const stemGeometry = new CylinderGeometry(
    (STEM.width / 2) * k,
    (STEM.width / 2) * k,
    gy(stemTop),
    20,
  );
  stemGeometry.translate(0, gy(stemTop) / 2, 0);
  const dotGeometry = new SphereGeometry(DOT.r * k, 24, 16);
  dotGeometry.translate(0, gy(DOT.cy), 0);
  // The board: SIGN's outline grown by half its rounding stroke.
  const half = SIGN.width / 2;
  const board = new Shape();
  board.moveTo(gx(19 - half), gy(24 - half));
  board.lineTo(gx(38.5 + half * 0.41), gy(24 - half));
  board.lineTo(gx(47 + half * 1.41), gy(32.5));
  board.lineTo(gx(38.5 + half * 0.41), gy(41 + half));
  board.lineTo(gx(19 - half), gy(41 + half));
  board.closePath();
  const depth = 0.06;
  const boardGeometry = new ExtrudeGeometry(board, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  boardGeometry.translate(0, 0, -depth / 2);
  const stationGeometry = new CircleGeometry(STATION_RADIUS, 40);
  stationGeometry.rotateX(-Math.PI / 2);
  const shadeGeometry = new CircleGeometry(SHADE_RADIUS, 32);
  shadeGeometry.rotateX(-Math.PI / 2);

  const signs: Group[] = [];
  for (const stop of STOPS) {
    const at = curve.getPointAt(stop.t);
    const tangent = curve.getTangentAt(stop.t);
    const side = new Vector3().crossVectors(tangent, up).normalize();
    const sign = new Group();
    sign.add(new Mesh(stemGeometry, signMaterial));
    sign.add(new Mesh(dotGeometry, signMaterial));
    sign.add(new Mesh(boardGeometry, signMaterial));
    sign.position.copy(at).addScaledVector(side, SIGN_OFFSET * stop.side);
    // Face back down the route, towards whoever is coming.
    sign.rotation.y = Math.atan2(-tangent.x, -tangent.z);
    sign.scale.set(1, 0.001, 1);
    scene.add(sign);
    const shade = new Mesh(shadeGeometry, shadeMaterial);
    shade.position.set(sign.position.x, 0.006, sign.position.z);
    shade.scale.set(1, 1, 0.6);
    scene.add(shade);
    signs.push(sign);
    const station = new Mesh(stationGeometry, stationMaterial(stop.module));
    station.position.set(at.x, 0.008, at.z);
    scene.add(station);
  }

  scene.add(new HemisphereLight(0xffffff, new Color(colours.background), 2.2));
  const sun = new DirectionalLight(0xffffff, 1.4);
  sun.position.set(-4, 8, 6);
  scene.add(sun);

  // --- Camera ----------------------------------------------------------------------------
  const eye = new Vector3();
  const target = new Vector3();
  let travel = 0; // 0…1 as the hero scrolls away
  const pointer = { x: 0, y: 0 };
  const turn = { x: 0, y: 0 };
  const arrival = { start: 0, done: false };
  const ARRIVAL_MS = 1600;
  const SIGN_MS = 700;
  const SIGN_STAGGER = 110;

  function place(now: number) {
    const t = Math.min(CAMERA.t + travel * CAMERA.travel, 0.95);
    const elapsed = arrival.start ? now - arrival.start : 0;
    const settle = arrival.done ? 1 : easeOut(elapsed / ARRIVAL_MS);
    eye.copy(curve.getPointAt(t));
    eye.y = CAMERA.height + (1 - settle) * 2.4;
    target.copy(curve.getPointAt(Math.min(t + CAMERA.lookAhead, 1)));
    target.y = CAMERA.lookHeight;
    camera.position.copy(eye);
    camera.lookAt(target);
    camera.rotateY(-turn.x * 0.07);
    camera.rotateX(-turn.y * 0.035);
    signs.forEach((sign, i) => {
      const grow = arrival.done ? 1 : easeOut((elapsed - i * SIGN_STAGGER) / SIGN_MS);
      sign.scale.y = Math.max(grow, 0.001);
    });
    if (!arrival.done && elapsed > ARRIVAL_MS + SIGN_STAGGER * signs.length + SIGN_MS)
      arrival.done = true;
  }

  // --- Drawing on demand -----------------------------------------------------------------
  let frame = 0;
  let visible = true;
  let ready = false;
  const draw = (now: number) => {
    frame = 0;
    if (!visible || document.hidden) return;
    if (!arrival.start && ready) arrival.start = now;
    const before = { x: turn.x, y: turn.y };
    turn.x += (pointer.x - turn.x) * 0.08;
    turn.y += (pointer.y - turn.y) * 0.08;
    place(now);
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady();
    }
    const turning = Math.abs(turn.x - before.x) + Math.abs(turn.y - before.y) > 1e-4;
    if (!arrival.done || turning) request();
  };
  const request = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    request();
  };
  const resizing = new ResizeObserver(resize);
  resizing.observe(host);

  const seen = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) request();
  });
  seen.observe(host);

  const hero = host.closest('section') ?? host;
  const onScroll = () => {
    const box = hero.getBoundingClientRect();
    travel = Math.min(Math.max(-box.top / Math.max(box.height, 1), 0), 1);
    request();
  };
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const onPointer = (event: PointerEvent) => {
    if (!fine.matches) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    request();
  };
  const onVisibility = () => {
    if (!document.hidden) request();
  };
  const recolour = () => {
    colours = palette(currentMode());
    fog.color.set(colours.background);
    signMaterial.color.set(colours.signal);
    routeMaterial.color.set(colours.route);
    for (const [m, material] of stationMaterials) material.color.set(colours.line(m));
    request();
  };
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  const themeWatch = new MutationObserver(recolour);
  themeWatch.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  const onLost = (event: Event) => {
    event.preventDefault();
    options.onLost();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  scheme.addEventListener('change', recolour);
  canvas.addEventListener('webglcontextlost', onLost);
  onScroll();
  resize();

  return {
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      resizing.disconnect();
      seen.disconnect();
      themeWatch.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      scheme.removeEventListener('change', recolour);
      canvas.removeEventListener('webglcontextlost', onLost);
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          geometries.add(object.geometry);
          materials.add(object.material as Material);
        }
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
