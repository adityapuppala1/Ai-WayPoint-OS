/**
 * A small reader for this package's stylesheets, so tests can hold every component to the
 * same rules (one focus ring, hover only where there is a pointer, a fallback before each
 * newer feature). It understands what these files use: rules, and rules inside at-rules.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Declaration {
  prop: string;
  value: string;
}

export interface Rule {
  file: string;
  /** The selector list as written, on one line. */
  selector: string;
  declarations: Declaration[];
  /** The at-rules this rule sits in, outermost first, e.g. ["@layer components", "@media (hover: hover)"]. */
  within: string[];
}

const SRC = join(__dirname, '..', 'src');

/** Every stylesheet this package owns: the components and the shared base styles. */
export function stylesheets(): string[] {
  const components = readdirSync(join(SRC, 'components'))
    .filter((f) => f.endsWith('.module.css'))
    .map((f) => `components/${f}`);
  return [...components, 'styles/base.css', 'styles/utilities.css'];
}

export function parse(file: string): Rule[] {
  const css = readFileSync(join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const stack: Array<{ prelude: string; at: boolean; body: string }> = [];
  let text = '';
  for (const ch of css) {
    if (ch === '{') {
      const prelude = text.trim().replace(/\s+/g, ' ');
      stack.push({ prelude, at: prelude.startsWith('@'), body: '' });
      text = '';
    } else if (ch === '}') {
      const block = stack.pop();
      if (block && !block.at) {
        const declarations = (block.body + text)
          .split(';')
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => {
            const i = d.indexOf(':');
            return {
              prop: d.slice(0, i).trim(),
              value: d
                .slice(i + 1)
                .trim()
                .replace(/\s+/g, ' '),
            };
          });
        rules.push({
          file,
          selector: block.prelude,
          declarations,
          within: stack.filter((b) => b.at).map((b) => b.prelude),
        });
      }
      text = '';
    } else {
      text += ch;
    }
  }
  return rules;
}

export const allRules = (): Rule[] => stylesheets().flatMap(parse);

/** Steps of an animation (from, to, 60%) are not selectors. */
export const inKeyframes = (rule: Rule) => rule.within.some((w) => w.startsWith('@keyframes'));

export const where = (rule: Rule) => `${rule.file}: ${rule.selector}`;
