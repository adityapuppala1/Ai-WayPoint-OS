import { moduleColours } from '@waypoint/ui';
import { DOT, SIGN, STEM } from '../brand/geometry';
import { HERO_ART } from './hero-art';

/**
 * The hero as a drawing: the 3D scene's first frame, projected from the same route
 * (hero-art.ts, made by `pnpm brand`). Shown at once, drawn by the server, and kept wherever
 * the scene is not loaded. Decoration only: the words beside it say everything.
 * Painted far to near, so nearer things cover farther ones.
 */
export function HeroArt() {
  const { width, height, solid, dashes, signs, shades, stations } = HERO_ART;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <g id="hero-sign">
          <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} />
          <path
            d={STEM.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={STEM.width}
            strokeLinecap="round"
          />
          <path d={SIGN.d} stroke="currentColor" strokeWidth={SIGN.width} strokeLinejoin="round" />
        </g>
      </defs>
      <g fill="var(--hero-route)">
        {[...dashes].reverse().map((dash) => (
          <path key={dash.d} d={dash.d} opacity={dash.o} />
        ))}
        <path d={solid} />
      </g>
      {[...stations].reverse().map((s) => (
        <ellipse
          key={`${s.cx},${s.cy}`}
          cx={s.cx}
          cy={s.cy}
          rx={s.rx}
          ry={s.ry}
          fill={moduleColours(s.module as 'today').line}
          opacity={s.o}
        />
      ))}
      <g fill="#000">
        {shades.map((s) => (
          <ellipse key={`${s.cx},${s.cy}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} opacity={s.o} />
        ))}
      </g>
      <g fill="var(--wp-signal)" color="var(--wp-signal)">
        {[...signs].reverse().map((s) => (
          <use
            key={`${s.x},${s.y}`}
            href="#hero-sign"
            transform={`translate(${s.x} ${s.y}) scale(${s.s})`}
            opacity={s.o}
          />
        ))}
      </g>
    </svg>
  );
}
