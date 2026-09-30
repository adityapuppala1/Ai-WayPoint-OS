import {
  contrast,
  contrastReport,
  dark,
  elevation,
  light,
  MODULE_LINES,
  moduleLine,
  motion,
  toHex,
} from '@waypoint/tokens';
import { PageHeader } from '@waypoint/ui';
import type { Metadata } from 'next';
import styles from './design.module.css';
import { DesignShowcase } from './showcase';

export const metadata: Metadata = { title: 'Design system' };

const ROLE_GROUPS: Array<{ title: string; roles: Array<keyof typeof light> }> = [
  { title: 'Surfaces', roles: ['canvas', 'raised', 'sunken', 'overlay'] },
  { title: 'Text', roles: ['text', 'textSecondary', 'textMuted'] },
  { title: 'Sign & signal', roles: ['sign', 'signText', 'signal', 'signalTint'] },
  { title: 'States', roles: ['fillHover', 'fillPressed', 'marker', 'focusRing'] },
  { title: 'Status', roles: ['danger', 'caution', 'safe', 'info', 'support'] },
];

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const ratio = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)}:1`;

/** How far each surface stands from the page, in both themes: the numbers behind "depth". */
const SURFACES = (['raised', 'overlay', 'sunken', 'sign'] as const).map((role) => ({
  role,
  light: ratio(contrast(light[role], light.canvas)),
  dark: ratio(contrast(dark[role], dark.canvas)),
}));

const ELEVATION = [
  { step: 1, use: 'Panels, lists, cards at rest' },
  { step: 2, use: 'The Sign, a card under the pointer, tooltips' },
  { step: 3, use: 'Menus, dialogs, sheets, toasts' },
] as const;

const MOTION: Array<{ token: string; value: string; use: string }> = [
  {
    token: '--wp-duration-instant',
    value: `${motion.instant}ms`,
    use: 'Tooltips and menus leaving',
  },
  { token: '--wp-duration-fast', value: `${motion.fast}ms`, use: 'Hover, pressed, focus' },
  { token: '--wp-duration-base', value: `${motion.base}ms`, use: 'Markers, disclosure, dialogs' },
  { token: '--wp-duration-slow', value: `${motion.slow}ms`, use: 'Sheets, toasts, meters' },
  {
    token: '--wp-duration-flip',
    value: `${motion.flip}ms`,
    use: 'The Sign flipping to the next step',
  },
  {
    token: '--wp-duration-route',
    value: `${motion.route}ms`,
    use: 'The route filling to the next station',
  },
  {
    token: '--wp-press-scale',
    value: String(motion.pressScale),
    use: 'How far a control gives when pressed',
  },
];

export default function DesignPage() {
  const lightReport = contrastReport('light');
  const darkReport = contrastReport('dark');
  const failures = [...lightReport, ...darkReport].filter((r) => !r.pass);
  return (
    <main id="main" className={styles.page}>
      <PageHeader
        module="today"
        title="Design system"
        lead="Wayfinding signage and transit route lines, for people reading in a second language on a small screen in bright light. One sign per screen. Routes only for real sequences. Colour always paired with words."
      />

      <section className={styles.section} aria-labelledby="colour">
        <h2 id="colour">Colour roles</h2>
        <div className={styles.swatchGroups}>
          {ROLE_GROUPS.map((g) => (
            <div key={g.title} className={styles.swatchGroup}>
              <h3>{g.title}</h3>
              {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none */}
              <ul role="list" className={styles.swatches}>
                {g.roles.map((r) => (
                  <li key={r} className={styles.swatch}>
                    <span className={styles.chip} style={{ background: `var(--wp-${kebab(r)})` }} />
                    <span className={styles.swatchName}>{r}</span>
                    <span className="wp-meta wp-num">
                      {toHex(light[r])} / {toHex(dark[r])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <h3 className={styles.subhead}>Module lines</h3>
        {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none */}
        <ul role="list" className={styles.lines}>
          {(Object.keys(MODULE_LINES) as Array<keyof typeof MODULE_LINES>).map((m) => (
            <li key={m} className={styles.line}>
              <span className={styles.lineBar} style={{ background: `var(--wp-line-${m})` }} />
              <span>{m}</span>
              <span className="wp-meta wp-num">{toHex(moduleLine(m))}</span>
            </li>
          ))}
        </ul>
        <p className="wp-secondary">
          Contrast: {lightReport.length + darkReport.length - failures.length} of{' '}
          {lightReport.length + darkReport.length} checked pairs meet WCAG 2.2 AA
          {failures.length ? ` (${failures.map((f) => f.pair).join(', ')} need work)` : '.'}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="depth">
        <h2 id="depth">Depth</h2>
        <p className="wp-secondary wp-measure">
          Three surfaces and three steps of elevation. In the light a panel is lifted by a soft
          shadow of two layers; in the dark, where a shadow hardly shows, by a lighter surface and a
          lit top edge. The Sign is the boldest shape on the page in both.
        </p>
        <div className={styles.elevations}>
          {ELEVATION.map((e) => (
            <div
              key={e.step}
              className={styles.elevation}
              data-testid={`elevation-${e.step}`}
              style={{ boxShadow: `var(--wp-shadow-${e.step})` }}
            >
              <strong>Step {e.step}</strong>
              <span className="wp-secondary">{e.use}</span>
              <code className="wp-meta">--wp-shadow-{e.step}</code>
              <span className="wp-visually-hidden">
                {elevation.light[e.step]} / {elevation.dark[e.step]}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="wp-visually-hidden">
              How far each surface stands from the page
            </caption>
            <thead>
              <tr>
                <th scope="col">Against the page</th>
                <th scope="col">Light</th>
                <th scope="col">Dark</th>
              </tr>
            </thead>
            <tbody>
              {SURFACES.map((s) => (
                <tr key={s.role}>
                  <th scope="row">{s.role}</th>
                  <td className="wp-num">{s.light}</td>
                  <td className="wp-num">{s.dark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className={styles.subhead}>Focus</h3>
        <p className="wp-secondary wp-measure">
          One ring everywhere, from one token: 2px in the text colour and a 3px signal halo. Two
          colours, so one of them shows on every surface. Flush controls draw it inside.
        </p>
        <div className={styles.focusRow}>
          <span className={styles.focusDemo} data-surface="canvas">
            On the page
          </span>
          <span className={styles.focusDemo} data-surface="raised">
            On a panel
          </span>
          <span className={styles.focusDemo} data-surface="overlay">
            On a dialog
          </span>
          <span className={styles.focusDemo} data-surface="sign">
            On the Sign
          </span>
          <span className={styles.focusDemo} data-surface="inset">
            Inside a row
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="motion">
        <h2 id="motion">Motion</h2>
        <p className="wp-secondary wp-measure">
          Everything that moves answers something the person just did, in 120 to 240 milliseconds.
          One moment is longer and meant to be watched: a step is completed, the route fills to the
          next station and the Sign flips. Lite mode switches all of it off; a request for less
          motion makes it instant.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="wp-visually-hidden">Motion tokens</caption>
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Value</th>
                <th scope="col">Used for</th>
              </tr>
            </thead>
            <tbody>
              {MOTION.map((m) => (
                <tr key={m.token}>
                  <th scope="row">
                    <code>{m.token}</code>
                  </th>
                  <td className="wp-num">{m.value}</td>
                  <td>{m.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="type">
        <h2 id="type">Type</h2>
        <div className={styles.typeScale}>
          <p style={{ fontSize: 'var(--wp-text-sign)', fontWeight: 600, lineHeight: 1.15 }}>
            Sign 48 — Finish your CV
          </p>
          <p style={{ fontSize: 'var(--wp-text-h1)', fontWeight: 600, lineHeight: 1.15 }}>
            Heading 1 — 40
          </p>
          <p style={{ fontSize: 'var(--wp-text-h2)', fontWeight: 600, lineHeight: 1.15 }}>
            Heading 2 — 33
          </p>
          <p style={{ fontSize: 'var(--wp-text-h3)', fontWeight: 600, lineHeight: 1.25 }}>
            Heading 3 — 28
          </p>
          <p style={{ fontSize: 'var(--wp-text-h4)', fontWeight: 600, lineHeight: 1.25 }}>
            Heading 4 — 23
          </p>
          <p className="wp-lead">
            Lead 19 — Waypoint helps you see what is changing and choose one next step.
          </p>
          <p>
            Body 16 — Overpass, an open typeface derived from the road signs of the Highway Gothic
            family. हिन्दी में भी पढ़ने में आसान। العربية أيضاً.
          </p>
          <p className="wp-secondary">Secondary 14 — supporting text and list details.</p>
          <p className="wp-meta">Meta 12 — timestamps and legal only.</p>
        </div>
      </section>

      <DesignShowcase />
    </main>
  );
}
