/**
 * The app's own stylesheets keep the design system's rules for states, read from the source
 * (no browser needed): hover only where a pointer can hover, focus drawn with the one focus
 * token, and the "you are here" marker in the marker colour. The design system checks its
 * own components the same way (packages/ui/test/styles.test.ts).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';

const SRC = join(import.meta.dirname, '..', 'src');

function moduleSheets(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return moduleSheets(path);
    return name.endsWith('.module.css') ? [path] : [];
  });
}

interface Rule {
  file: string;
  selector: string;
  declarations: Array<{ prop: string; value: string }>;
  /** The at-rules around the rule, outermost first. */
  within: string[];
}

/** Rules and the at-rules they sit in; enough for these files (no nested selectors). */
function parse(path: string): Rule[] {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const file = relative(SRC, path).replaceAll('\\', '/');
  const rules: Rule[] = [];
  const stack: Array<{ prelude: string; at: boolean }> = [];
  let text = '';
  for (const ch of css) {
    if (ch === '{') {
      const prelude = text.trim().replace(/\s+/g, ' ');
      stack.push({ prelude, at: prelude.startsWith('@') });
      text = '';
    } else if (ch === '}') {
      const block = stack.pop();
      if (block && !block.at) {
        rules.push({
          file,
          selector: block.prelude,
          declarations: text
            .split(';')
            .map((d) => d.trim())
            .filter(Boolean)
            .map((d) => ({
              prop: d.slice(0, d.indexOf(':')).trim(),
              value: d
                .slice(d.indexOf(':') + 1)
                .trim()
                .replace(/\s+/g, ' '),
            })),
          within: stack.filter((b) => b.at).map((b) => b.prelude),
        });
      }
      text = '';
    } else text += ch;
  }
  return rules.filter((r) => !r.within.some((w) => w.startsWith('@keyframes')));
}

const rules = moduleSheets().flatMap(parse);
const where = (r: Rule) => `${r.file}: ${r.selector}`;

test.describe('page styles keep the state rules @desktop', () => {
  test('hover styles apply only where a pointer can hover', () => {
    // Without the guard a fill stays on after a tap on a phone until something else is touched.
    const unguarded = rules
      .filter((r) => /:hover|\[data-hovered\]/.test(r.selector))
      .filter((r) => !r.within.includes('@media (hover: hover)'))
      .map(where);
    expect(unguarded).toEqual([]);
  });

  test('focus is drawn with the one focus token, never a ring of its own', () => {
    const FOCUS = /focus-visible|data-focus-visible|data-focused|data-focus-within|:focus\b/;
    const own = rules
      .filter((r) => FOCUS.test(r.selector))
      .filter((r) =>
        r.declarations.some(
          (d) =>
            (d.prop === 'box-shadow' && !d.value.includes('var(--wp-focus-shadow')) ||
            (d.prop === 'outline' && !/transparent|CanvasText|none/.test(d.value)),
        ),
      )
      .map(where);
    expect(own).toEqual([]);
  });

  test('the marker on the chosen tab or place is the marker colour, not yellow alone', () => {
    // Signal yellow is 1.4:1 on a light page: it may sit beside a marker, never be one.
    const yellow = rules
      .filter((r) => /aria-current|\.active|data-selected|data-pending/.test(r.selector))
      .filter((r) =>
        r.declarations.some(
          (d) =>
            /^(background|border(-block-end|-inline-start)?(-color)?|box-shadow)$/.test(d.prop) &&
            d.value.includes('var(--wp-signal)'),
        ),
      )
      .map(where);
    expect(yellow).toEqual([]);
  });

  test('shadows come from the elevation and focus tokens', () => {
    // A raw shadow drifts from the three steps of depth (and from the dark theme's lit edge).
    const raw = rules
      .flatMap((r) =>
        r.declarations
          .filter((d) => d.prop === 'box-shadow' && /rgb|#[0-9a-f]{3,8}\b|hsl/i.test(d.value))
          .map(() => where(r)),
      )
      .filter((w) => !w.startsWith('components/join/poster.module.css'));
    expect(raw).toEqual([]);
  });
});
