/**
 * Rules every stylesheet in the design system keeps, checked against the source: one focus
 * ring, hover only where there is a pointer, a pressed state on everything that is pressed,
 * no physical sides (so Arabic mirrors), and a plain value before each newer CSS feature.
 */
import { describe, expect, it } from 'vitest';
import { allRules, inKeyframes, parse, type Rule, where } from './css';

const rules = allRules().filter((r) => !inKeyframes(r));
const SUPPORTS_MIX = '@supports (color: color-mix(in oklch, red, blue))';

/** Splits "a b(c d) e" into its top-level parts. */
function parts(value: string, separator: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && separator.test(ch)) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const find = (file: string, selector: string): Rule[] =>
  rules.filter(
    (r) =>
      r.file.endsWith(file) &&
      r.selector
        .split(',')
        .map((s) => s.trim())
        .includes(selector),
  );

describe('states, the same in every component', () => {
  it('shows hover styles only where there is a pointer that can hover', () => {
    // Without the guard a fill sticks after a tap on a phone until something else is touched.
    const unguarded = rules
      .filter((r) => /:hover|\[data-hovered\]/.test(r.selector))
      .filter((r) => !r.within.includes('@media (hover: hover)'))
      .map(where);
    expect(unguarded).toEqual([]);
  });

  it('draws focus with the one focus token, never a ring of its own', () => {
    const FOCUS = /focus-visible|data-focus-visible|data-focused|data-focus-within|:focus\b/;
    const own = rules
      // Links in running text have their own treatment: the signal highlight behind the words.
      .filter((r) => !(r.file.endsWith('base.css') && r.selector === 'a:focus-visible'))
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

  it('gives every focusable control the focus ring', () => {
    const focusable: Array<[string, string]> = [
      ['base.css', ':focus-visible'],
      ['Button.module.css', '.button[data-focus-visible]'],
      ['IconButton.module.css', '.iconButton[data-focus-visible]'],
      ['Tabs.module.css', '.tab[data-focus-visible]'],
      ['Tabs.module.css', '.segment[data-focus-visible]'],
      ['Tabs.module.css', '.panel[data-focus-visible]'],
      ['Disclosure.module.css', '.trigger[data-focus-visible]'],
      ['List.module.css', 'a.row:focus-visible'],
      ['Toast.module.css', '.toast[data-focus-visible]'],
      ['Toast.module.css', '.close[data-focus-visible]'],
      ['Toast.module.css', '.action[data-focus-visible]'],
      ['Stepper.module.css', '.group[data-focus-within]'],
      ['Stepper.module.css', '.button[data-focus-visible]'],
      ['Field.module.css', '.control[data-focused]'],
      ['Field.module.css', '.selectButton[data-focus-visible]'],
      ['Field.module.css', '.choice[data-focus-visible] .box'],
      ['Field.module.css', '.switch[data-focus-visible] .track'],
      ['Field.module.css', '.sliderThumb[data-focus-visible]'],
      ['CommandPalette.module.css', '.item[data-focus-visible]'],
    ];
    const missing = focusable
      .filter(
        ([file, selector]) =>
          !find(file, selector).some((r) =>
            r.declarations.some(
              (d) => d.prop === 'box-shadow' && d.value.includes('var(--wp-focus-shadow'),
            ),
          ),
      )
      .map(([file, selector]) => `${file}: ${selector}`);
    expect(missing).toEqual([]);
  });

  it('lets the ring take the text colour of the Sign inside the Sign and a toast', () => {
    for (const [file, selector] of [
      ['Sign.module.css', '.sign'],
      ['Toast.module.css', '.toast'],
    ] as const) {
      const declared = find(file, selector).some((r) =>
        r.declarations.some(
          (d) => d.prop === '--wp-focus-shadow' && d.value === 'var(--wp-focus-shadow-on-sign)',
        ),
      );
      expect(declared, `${file}: ${selector}`).toBe(true);
    }
  });

  it('gives everything that is pressed a pressed state and a 120ms transition', () => {
    // [file, the pressed rule, the rule that carries the transition]
    const pressable: Array<[string, string, string]> = [
      ['Button.module.css', '.button[data-pressed]', '.button'],
      ['IconButton.module.css', '.iconButton[data-pressed]', '.iconButton'],
      ['Tabs.module.css', '.tab[data-pressed]', '.tab'],
      ['Tabs.module.css', '.segment[data-pressed]', '.segment'],
      ['Disclosure.module.css', '.trigger[data-pressed]', '.trigger'],
      ['List.module.css', 'a.row:active', 'a.row'],
      ['Menu.module.css', '.item[data-pressed]', '.item'],
      ['Field.module.css', '.option[data-pressed]', '.option'],
      ['Field.module.css', '.selectButton[data-pressed]', '.control'],
      ['Field.module.css', '.choice[data-pressed] .box', '.box'],
      ['Field.module.css', '.switch[data-pressed] .thumb', '.thumb'],
      ['Toast.module.css', '.close[data-pressed]', '.close'],
      ['Toast.module.css', '.action[data-pressed]', '.action'],
      ['Stepper.module.css', '.button[data-pressed]', '.button'],
      ['CommandPalette.module.css', '.item[data-pressed]', '.item'],
    ];
    const problems: string[] = [];
    for (const [file, pressed, base] of pressable) {
      if (!find(file, pressed).some((r) => r.declarations.length > 0))
        problems.push(`${file}: no ${pressed}`);
      const moves = find(file, base).some((r) =>
        r.declarations.some(
          (d) => d.prop === 'transition' && d.value.includes('var(--wp-duration-fast)'),
        ),
      );
      if (!moves) problems.push(`${file}: ${base} has no 120ms transition`);
    }
    expect(problems).toEqual([]);
  });

  it('never overrides the rules that switch motion off', () => {
    // Lite mode and reduced motion are decided once, in base.css, for everything.
    const base = parse('styles/base.css');
    const lite = base.find((r) => r.selector.includes(':root[data-lite="true"] *'));
    expect(lite?.declarations).toEqual(
      expect.arrayContaining([
        { prop: 'animation', value: 'none !important' },
        { prop: 'transition', value: 'none !important' },
      ]),
    );
    const reduced = base.find((r) => r.within.includes('@media (prefers-reduced-motion: reduce)'));
    expect(reduced?.declarations).toEqual(
      expect.arrayContaining([
        { prop: 'animation-duration', value: '1ms !important' },
        { prop: 'transition-duration', value: '1ms !important' },
      ]),
    );
    const forced = rules
      .filter((r) => !r.file.endsWith('base.css'))
      .filter((r) =>
        r.declarations.some(
          (d) => /^(animation|transition)/.test(d.prop) && d.value.includes('!important'),
        ),
      )
      .map(where);
    expect(forced).toEqual([]);
  });
});

describe('page transitions', () => {
  // The browser draws a page transition on pseudo-elements of the page, which "*" does not
  // reach: they need rules of their own, in the same place as the rest.
  const PARTS = ['group', 'old', 'new'].map((part) => `::view-transition-${part}(*)`);
  const base = parse('styles/base.css');
  const utilities = parse('styles/utilities.css');
  const declares = (rule: Rule | undefined, prop: string, value: string) =>
    rule?.declarations.some((d) => d.prop === prop && d.value === value) ?? false;

  it('are switched off by lite mode', () => {
    const rule = base.find((r) => r.selector.includes(':root[data-lite="true"]::view-transition'));
    for (const part of PARTS)
      expect(rule?.selector, part).toContain(`:root[data-lite="true"]${part}`);
    expect(declares(rule, 'animation', 'none !important')).toBe(true);
  });

  it('are instant when the device asks for less motion', () => {
    const rule = base.find(
      (r) =>
        r.within.includes('@media (prefers-reduced-motion: reduce)') &&
        r.selector.includes('::view-transition'),
    );
    for (const part of PARTS) expect(rule?.selector, part).toContain(part);
    expect(declares(rule, 'animation-duration', '1ms !important')).toBe(true);
    expect(declares(rule, 'animation-delay', '0s !important')).toBe(true);
  });

  it('keep the frame still: the rail, the bottom bar and the header are named and do not move', () => {
    for (const [className, name] of [
      ['.wp-vt-rail', 'wp-rail'],
      ['.wp-vt-bottom-bar', 'wp-bottom-bar'],
      ['.wp-vt-header', 'wp-header'],
    ] as const) {
      const named = utilities.find((r) => r.selector === className);
      expect(declares(named, 'view-transition-name', name), className).toBe(true);
      const find = (part: string) =>
        utilities.find((r) =>
          r.selector
            .split(',')
            .map((s) => s.trim())
            .includes(`::view-transition-${part}(${name})`),
        );
      expect(declares(find('group'), 'animation', 'none'), name).toBe(true);
      expect(declares(find('new'), 'animation', 'none'), name).toBe(true);
      // The picture of the old frame is dropped, or both would show for a moment.
      expect(declares(find('old'), 'display', 'none'), name).toBe(true);
    }
  });

  it('move a page out and the next one in with the motion tokens, and leave the page usable', () => {
    const out = utilities.find((r) => r.selector === '::view-transition-old(.wp-page-out)');
    const into = utilities.find((r) => r.selector === '::view-transition-new(.wp-page-in)');
    for (const rule of [out, into]) {
      const animation = rule?.declarations.find((d) => d.prop === 'animation')?.value ?? '';
      expect(animation).toContain('var(--wp-duration-');
      expect(animation).not.toMatch(/\d+ms|\ds\b/);
    }
    // While it runs, presses go to the page underneath instead of being swallowed.
    const overlay = utilities.find((r) => r.selector === '::view-transition');
    expect(declares(overlay, 'pointer-events', 'none')).toBe(true);
  });
});

describe('right to left', () => {
  it('uses no physical sides, so Arabic mirrors without special cases', () => {
    const problems: string[] = [];
    for (const r of rules) {
      for (const d of r.declarations) {
        const at = `${where(r)} { ${d.prop}: ${d.value} }`;
        if (
          /(^|-)(left|right)$/.test(d.prop) ||
          /^(margin|padding|border)-(left|right)/.test(d.prop)
        )
          problems.push(at);
        if (/^(text-align|float|clear)$/.test(d.prop) && /^(left|right)$/.test(d.value))
          problems.push(at);
        const values = parts(d.value, /\s/);
        // top right bottom left: the two sides must match, or it is wrong in Arabic.
        if (/^(padding|margin|inset|border-width)$/.test(d.prop) && values.length === 4) {
          if (values[1] !== values[3]) problems.push(at);
        }
        // top-left top-right bottom-right bottom-left
        if (d.prop === 'border-radius' && values.length === 4) {
          if (values[0] !== values[1] || values[2] !== values[3]) problems.push(at);
        }
        if (d.prop === 'box-shadow') {
          for (const layer of parts(d.value, /,/)) {
            const lengths = parts(layer, /\s/).filter((p) => p !== 'inset');
            // A shadow pushed sideways (e.g. an edge bar drawn with "inset 4px 0 0") sits on
            // the wrong side in Arabic.
            if (
              /^-?[\d.]+(px|rem|em)?$/.test(lengths[0] ?? '') &&
              Number.parseFloat(lengths[0] ?? '0')
            )
              problems.push(at);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('older browsers', () => {
  /**
   * A newer feature must sit behind @supports, with a plain value for the same property in
   * the same rule outside it. (Two values in one rule would do too, but the linter reads
   * that as a mistake and a minifier may drop the first.)
   */
  function unguarded(uses: (value: string) => boolean, guard: string): string[] {
    const problems: string[] = [];
    for (const r of rules) {
      for (const d of r.declarations) {
        if (!uses(d.value)) continue;
        const plain = r.selector
          .split(',')
          .map((s) => s.trim())
          .every((selector) =>
            find(r.file, selector).some(
              (o) =>
                !o.within.includes(guard) &&
                o.declarations.some(
                  // "border" outside the guard covers "border-block-color" inside it.
                  (x) => (x.prop === d.prop || d.prop.startsWith(`${x.prop}-`)) && !uses(x.value),
                ),
            ),
          );
        if (!r.within.includes(guard) || !plain) problems.push(`${where(r)} { ${d.prop} }`);
      }
    }
    return problems;
  }

  it('keeps borders and fills without color-mix() (Safari before 16.2, Firefox before 113)', () => {
    expect(unguarded((v) => v.includes('color-mix('), SUPPORTS_MIX)).toEqual([]);
  });

  it('gives a vh height wherever dvh is used (Safari before 15.4, Chrome before 108)', () => {
    expect(unguarded((v) => /\ddvh/.test(v), '@supports (height: 100dvh)')).toEqual([]);
  });

  it('hides a scrollbar in WebKit too, wherever one is hidden', () => {
    const hidden = rules.filter((r) =>
      r.declarations.some((d) => d.prop === 'scrollbar-width' && d.value === 'none'),
    );
    const missing = hidden
      .filter(
        (r) =>
          !find(r.file, `${r.selector}::-webkit-scrollbar`).some((w) =>
            w.declarations.some((d) => d.prop === 'display' && d.value === 'none'),
          ),
      )
      .map(where);
    expect(missing).toEqual([]);
  });
});
