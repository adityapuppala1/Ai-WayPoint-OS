/**
 * The Waypoint logo: the mark (the "i" of information carrying a direction sign, on a slate
 * tile), the wordmark ("Waypoint" in Overpass SemiBold, drawn as a path), and the two together.
 *
 * Inline SVG in the theme's colours: the tile is `--wp-sign` and the glyph `--wp-signal`, as on
 * the Sign; the wordmark is `currentColor`. So it follows light and dark, needs no request and
 * no font (it looks the same in lite mode, which swaps the web font for the system's).
 *
 * Give `title` when the logo is the only thing that names a link or a page; leave it out when
 * text beside it (or the link's own label) already says "Waypoint", and it is hidden from
 * screen readers. A logo is a name, not text to mirror: it reads left to right in Arabic too.
 *
 * Every other copy of the drawing (favicon, app icons, public/brand) is made from
 * ./geometry.ts by `pnpm brand`.
 */
import type { CSSProperties } from 'react';
import { DOT, MARK_GRID, SIGN, STEM, TILE_RADIUS } from './geometry';
import { WORDMARK } from './wordmark';

type Labelled = { title?: string; className?: string; style?: CSSProperties };

/** The glyph alone: dot, stem and sign, in one colour (the brand yellow unless `fill` says). */
function Glyph({ fill }: { fill: string }) {
  return (
    <>
      <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={fill} />
      <path d={STEM.d} fill="none" stroke={fill} strokeWidth={STEM.width} strokeLinecap="round" />
      <path d={SIGN.d} fill={fill} stroke={fill} strokeWidth={SIGN.width} strokeLinejoin="round" />
    </>
  );
}

/**
 * The mark. `tone="tile"` (default) is the app icon: yellow on the slate tile.
 * `tone="glyph"` is the glyph alone in `currentColor`, for one-colour use.
 */
export function LogoMark({
  size = 28,
  tone = 'tile',
  title,
  className,
  style,
}: Labelled & { size?: number | string; tone?: 'tile' | 'glyph' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_GRID} ${MARK_GRID}`}
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {tone === 'tile' ? (
        <>
          <rect width={MARK_GRID} height={MARK_GRID} rx={TILE_RADIUS} fill="var(--wp-sign)" />
          <Glyph fill="var(--wp-signal)" />
        </>
      ) : (
        <Glyph fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * The name, drawn. Its capitals are 0.7em tall, as Overpass's are, so it sits in a line of
 * text at the text's own size; set `font-size` on it (or its parent) to size it.
 */
export function Wordmark({ title, className, style }: Labelled) {
  const em = 0.7 / WORDMARK.cap;
  const height = WORDMARK.cap + WORDMARK.descent;
  return (
    <svg
      viewBox={`0 ${-WORDMARK.cap} ${WORDMARK.width} ${height}`}
      className={className}
      style={{
        inlineSize: `${WORDMARK.width * em}em`,
        blockSize: `${height * em}em`,
        // The descenders hang below the box, so centring the box centres the capitals.
        marginBlockEnd: `${-WORDMARK.descent * em}em`,
        flexShrink: 0,
        overflow: 'visible',
        ...style,
      }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={WORDMARK.d} fill="currentColor" />
    </svg>
  );
}

/**
 * Mark and name together. `markSize` is the mark's size (px or any CSS length); the name
 * takes the surrounding font size. `wordClassName` lets a narrow header hide the name and
 * keep the mark.
 */
export function Logo({
  title,
  markSize = 28,
  className,
  wordClassName,
  style,
}: Labelled & { markSize?: number | string; wordClassName?: string }) {
  const box: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45em' };
  const parts = (
    <>
      <LogoMark size={markSize} />
      <Wordmark className={wordClassName} />
    </>
  );
  return title ? (
    <span
      className={className}
      dir="ltr"
      style={{ ...box, ...style }}
      role="img"
      aria-label={title}
    >
      {parts}
    </span>
  ) : (
    <span className={className} dir="ltr" style={{ ...box, ...style }} aria-hidden>
      {parts}
    </span>
  );
}
