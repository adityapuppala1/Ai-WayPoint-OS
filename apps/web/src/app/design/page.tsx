import { contrastReport, dark, light, MODULE_LINES, moduleLine, toHex } from '@waypoint/tokens';
import type { Metadata } from 'next';
import styles from './design.module.css';
import { DesignShowcase } from './showcase';

export const metadata: Metadata = { title: 'Design system' };

const ROLE_GROUPS: Array<{ title: string; roles: Array<keyof typeof light> }> = [
  { title: 'Surfaces', roles: ['canvas', 'raised', 'sunken', 'overlay'] },
  { title: 'Text', roles: ['text', 'textSecondary', 'textMuted'] },
  { title: 'Sign & signal', roles: ['sign', 'signText', 'signal', 'signalTint'] },
  { title: 'Status', roles: ['danger', 'caution', 'safe', 'info', 'support'] },
];

export default function DesignPage() {
  const lightReport = contrastReport('light');
  const darkReport = contrastReport('dark');
  const failures = [...lightReport, ...darkReport].filter((r) => !r.pass);
  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1>Design system</h1>
        <p className="wp-lead wp-measure">
          Wayfinding signage and transit route lines, for people reading in a second language on a
          small screen in bright light. One sign per screen. Routes only for real sequences. Colour
          always paired with words.
        </p>
      </header>

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
                    <span
                      className={styles.chip}
                      style={{
                        background: `var(--wp-${r.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`,
                      }}
                    />
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
