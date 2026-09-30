/**
 * OKLCH helpers. Colours are designed in OKLCH (perceptually even lightness, so every
 * module line colour and every tint step feels equally strong) and converted to sRGB hex
 * for platforms that cannot use `oklch()` (React Native, e-mail, SMS previews).
 */

export interface Oklch {
  /** Lightness 0–1 */
  l: number;
  /** Chroma, ~0–0.37 */
  c: number;
  /** Hue in degrees */
  h: number;
  /** Alpha 0–1 */
  a?: number;
}

export const oklch = (l: number, c: number, h: number, a?: number): Oklch => ({ l, c, h, a });

/** CSS string, e.g. `oklch(52% 0.13 155 / 0.12)`. */
export function toCss(color: Oklch): string {
  const l = `${round(color.l * 100, 2)}%`;
  const c = round(color.c, 4);
  const h = round(color.h, 2);
  return color.a === undefined || color.a >= 1
    ? `oklch(${l} ${c} ${h})`
    : `oklch(${l} ${c} ${h} / ${round(color.a, 3)})`;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** OKLCH → linear sRGB (Björn Ottosson's OKLab matrices). */
function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const inGamut = (rgb: [number, number, number]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * Map to the sRGB gamut by reducing chroma (keeps lightness and hue, which is what
 * matters for contrast and identity), then gamma-encode.
 */
function toSrgb(color: Oklch): [number, number, number] {
  let lin = oklchToLinearSrgb(color);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearSrgb({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinearSrgb({ ...color, c: lo });
  }
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

/** `#rrggbb` or `#rrggbbaa`. */
export function toHex(color: Oklch): string {
  const [r, g, b] = toSrgb(color).map((v) => Math.round(v * 255));
  const hex = [r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('');
  if (color.a === undefined || color.a >= 1) return `#${hex}`;
  return `#${hex}${Math.round(color.a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

/** WCAG 2.x relative luminance of an opaque colour. */
export function luminance(color: Oklch): number {
  const srgb = toSrgb(color);
  const lin = srgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0);
}

/** WCAG 2.x contrast ratio between two opaque colours. */
export function contrast(a: Oklch, b: Oklch): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent colour over an opaque background (in sRGB), returning opaque OKLCH-ish hex. */
export function compositeHex(fg: Oklch, bg: Oklch): string {
  const a = fg.a ?? 1;
  const f = toSrgb({ ...fg, a: 1 });
  const b = toSrgb(bg);
  const mix = f.map((v, i) => v * a + (b[i] ?? 0) * (1 - a));
  return `#${mix
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
