/**
 * Reading the little Markdown the assistant writes into blocks (paragraphs, lists, headings,
 * quotes) and inline pieces. Pure functions, so they're tested without a phone.
 */
import { isInternalPath } from '@waypoint/core/paths';

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    if (list) blocks.push({ kind: 'list', ...list });
    if (quote.length) blocks.push({ kind: 'quote', text: quote.join('\n') });
    paragraph = [];
    list = null;
    quote = [];
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1] ?? '' });
      continue;
    }
    const numbered = NUMBERED.test(line);
    if (numbered || BULLET.test(line)) {
      if (!list || list.ordered !== numbered) {
        flush();
        list = { ordered: numbered, items: [] };
      }
      list.items.push(line.replace(numbered ? NUMBERED : BULLET, ''));
      continue;
    }
    if (line.startsWith('>')) {
      if (!quote.length) flush();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    // An indented line under a list item continues that item.
    if (list && /^\s{2,}/.test(raw)) {
      const items: string[] = list.items;
      items[items.length - 1] = `${items[items.length - 1] ?? ''} ${line.trim()}`;
      continue;
    }
    if (list || quote.length) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

export const INLINE =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Links people can safely follow from an answer. */
export function safeHref(href: string): string | null {
  if (isInternalPath(href)) return href;
  return /^(https?:|tel:|sms:|mailto:)/i.test(href) ? href : null;
}
