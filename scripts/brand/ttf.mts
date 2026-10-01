/**
 * A very small TrueType reader: enough to turn a word set in Overpass into SVG paths, so the
 * wordmark is a drawing (the same in every browser, email client and app icon, and in lite
 * mode, which swaps the web font for the system's). It reads the tables a `glyf` font needs
 * (head, maxp, hhea, hmtx, cmap format 4, loca, glyf with composite glyphs); kerning is set
 * by hand in build.ts, as a wordmark is.
 */
import { readFileSync } from 'node:fs';

export interface Glyph {
  /** One SVG path per contour, in font units with y pointing down (baseline at 0). */
  contours: string[];
  /** Top of each contour (smallest y, so the highest point), to tell an i's dot from its stem. */
  tops: number[];
  advance: number;
}

export interface Font {
  unitsPerEm: number;
  /** `place` moves and scales the outline: x' = dx + x * scale, y' = dy + y * scale. */
  glyph(char: string, place?: Place): Glyph;
}

type Point = { x: number; y: number; on: boolean };
export type Place = { dx: number; dy: number; scale: number };

export function readFont(file: string): Font {
  const b = readFileSync(file);
  const tables: Record<string, number> = {};
  const count = b.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const o = 12 + 16 * i;
    tables[b.toString('latin1', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const at = (tag: string) => {
    const offset = tables[tag];
    if (offset === undefined) throw new Error(`The font has no ${tag} table`);
    return offset;
  };
  const head = at('head');
  const unitsPerEm = b.readUInt16BE(head + 18);
  const longLoca = b.readInt16BE(head + 50) === 1;
  const metrics = b.readUInt16BE(at('hhea') + 34);
  const hmtx = at('hmtx');
  const loca = at('loca');
  const glyf = at('glyf');

  // cmap: the Windows Unicode BMP subtable (format 4).
  const cmap = at('cmap');
  let sub = -1;
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const r = cmap + 4 + 8 * i;
    if (b.readUInt16BE(r) === 3 && b.readUInt16BE(r + 2) === 1) sub = cmap + b.readUInt32BE(r + 4);
  }
  if (sub < 0 || b.readUInt16BE(sub) !== 4) throw new Error('No format 4 cmap');
  const segs = b.readUInt16BE(sub + 6) / 2;
  const ends = sub + 14;
  const starts = ends + segs * 2 + 2;
  const deltas = starts + segs * 2;
  const ranges = deltas + segs * 2;
  const glyphIndex = (code: number): number => {
    for (let i = 0; i < segs; i++) {
      const end = b.readUInt16BE(ends + i * 2);
      if (code > end) continue;
      const start = b.readUInt16BE(starts + i * 2);
      if (code < start) return 0;
      const delta = b.readInt16BE(deltas + i * 2);
      const range = b.readUInt16BE(ranges + i * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const g = b.readUInt16BE(ranges + i * 2 + range + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };

  const advance = (g: number) => b.readUInt16BE(hmtx + 4 * Math.min(g, metrics - 1));
  const offsetOf = (g: number) =>
    longLoca ? b.readUInt32BE(loca + g * 4) : b.readUInt16BE(loca + g * 2) * 2;

  /** The contours of glyph `g` as point lists, composites resolved. */
  const contoursOf = (g: number): Point[][] => {
    const start = glyf + offsetOf(g);
    if (offsetOf(g + 1) === offsetOf(g)) return [];
    const n = b.readInt16BE(start);
    if (n < 0) {
      // Composite: other glyphs placed at an offset (scales are not used by these letters).
      const out: Point[][] = [];
      let p = start + 10;
      for (;;) {
        const flags = b.readUInt16BE(p);
        const index = b.readUInt16BE(p + 2);
        p += 4;
        let dx: number;
        let dy: number;
        if (flags & 1) {
          dx = b.readInt16BE(p);
          dy = b.readInt16BE(p + 2);
          p += 4;
        } else {
          dx = b.readInt8(p);
          dy = b.readInt8(p + 1);
          p += 2;
        }
        if (flags & 8) p += 2;
        else if (flags & 0x40) p += 4;
        else if (flags & 0x80) p += 8;
        for (const c of contoursOf(index))
          out.push(c.map((pt) => ({ x: pt.x + dx, y: pt.y + dy, on: pt.on })));
        if (!(flags & 0x20)) break;
      }
      return out;
    }
    let p = start + 10;
    const endPts: number[] = [];
    for (let i = 0; i < n; i++) endPts.push(b.readUInt16BE(p + i * 2));
    p += n * 2;
    p += 2 + b.readUInt16BE(p);
    const total = (endPts[n - 1] ?? -1) + 1;
    const flags: number[] = [];
    while (flags.length < total) {
      const f = b.readUInt8(p++);
      flags.push(f);
      if (f & 8) {
        const repeat = b.readUInt8(p++);
        for (let r = 0; r < repeat; r++) flags.push(f);
      }
    }
    const xs: number[] = [];
    let x = 0;
    for (const f of flags) {
      if (f & 2) {
        const d = b.readUInt8(p++);
        x += f & 16 ? d : -d;
      } else if (!(f & 16)) {
        x += b.readInt16BE(p);
        p += 2;
      }
      xs.push(x);
    }
    const ys: number[] = [];
    let y = 0;
    for (const f of flags) {
      if (f & 4) {
        const d = b.readUInt8(p++);
        y += f & 32 ? d : -d;
      } else if (!(f & 32)) {
        y += b.readInt16BE(p);
        p += 2;
      }
      ys.push(y);
    }
    const out: Point[][] = [];
    let first = 0;
    for (const end of endPts) {
      const contour: Point[] = [];
      for (let i = first; i <= end; i++)
        contour.push({ x: xs[i] ?? 0, y: -(ys[i] ?? 0), on: Boolean((flags[i] ?? 0) & 1) });
      out.push(contour);
      first = end + 1;
    }
    return out;
  };

  return {
    unitsPerEm,
    glyph(char, place = { dx: 0, dy: 0, scale: 1 }) {
      const g = glyphIndex(char.codePointAt(0) ?? 0);
      const contours = contoursOf(g).map((c) =>
        c.map((pt) => ({
          x: place.dx + pt.x * place.scale,
          y: place.dy + pt.y * place.scale,
          on: pt.on,
        })),
      );
      return {
        advance: advance(g),
        contours: contours.map(toPath),
        tops: contours.map((c) => Math.min(...c.map((pt) => pt.y))),
      };
    },
  };
}

const r = (n: number) => Math.round(n * 100) / 100;

/** A TrueType contour (quadratic, with implied on-curve points) as a closed SVG path. */
function toPath(points: Point[]): string {
  if (!points.length) return '';
  // Start on an on-curve point; if there is none, between the first two.
  let startIndex = points.findIndex((p) => p.on);
  const ring = [...points];
  let start: Point;
  if (startIndex < 0) {
    const a = points[0] as Point;
    const b = points[1] as Point;
    start = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true };
    startIndex = 0;
  } else start = points[startIndex] as Point;
  const ordered = [...ring.slice(startIndex + 1), ...ring.slice(0, startIndex + 1)];
  let d = `M${r(start.x)} ${r(start.y)}`;
  let control: Point | null = null;
  for (const p of ordered) {
    if (p.on) {
      d += control
        ? `Q${r(control.x)} ${r(control.y)} ${r(p.x)} ${r(p.y)}`
        : `L${r(p.x)} ${r(p.y)}`;
      control = null;
    } else if (control) {
      const mid = { x: (control.x + p.x) / 2, y: (control.y + p.y) / 2 };
      d += `Q${r(control.x)} ${r(control.y)} ${r(mid.x)} ${r(mid.y)}`;
      control = p;
    } else control = p;
  }
  if (control) d += `Q${r(control.x)} ${r(control.y)} ${r(start.x)} ${r(start.y)}`;
  return `${d}Z`;
}
