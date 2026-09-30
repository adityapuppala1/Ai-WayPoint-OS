import { describe, expect, it } from 'vitest';
import { INLINE, parseBlocks, safeHref } from '../src/features/markdown-parse';

describe('answers as Markdown', () => {
  it('splits paragraphs, headings, quotes and lists', () => {
    const blocks = parseBlocks(
      [
        '### Where to start',
        'Losing a job is hard.',
        'Here is a first step:',
        '1. Check your last payslip',
        '2. Call the helpline',
        '',
        '- one',
        '* two',
        '  still two',
        '',
        '> Take a breath.',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', text: 'Where to start' },
      { kind: 'paragraph', text: 'Losing a job is hard.\nHere is a first step:' },
      { kind: 'list', ordered: true, items: ['Check your last payslip', 'Call the helpline'] },
      { kind: 'list', ordered: false, items: ['one', 'two still two'] },
      { kind: 'quote', text: 'Take a breath.' },
    ]);
  });

  it('keeps bold text from looking like a list', () => {
    expect(parseBlocks('**Important:** call now')).toEqual([
      { kind: 'paragraph', text: '**Important:** call now' },
    ]);
  });

  it('finds bold, italics, code and links inside a line', () => {
    const tokens = [
      ...'Call **now**, *gently*, `STOP` or [the line](tel:988).'.matchAll(INLINE),
    ].map((m) => m[0]);
    expect(tokens).toEqual(['**now**', '*gently*', '`STOP`', '[the line](tel:988)']);
  });

  it('follows only safe links', () => {
    expect(safeHref('https://988lifeline.org')).toBe('https://988lifeline.org');
    expect(safeHref('tel:988')).toBe('tel:988');
    expect(safeHref('/support')).toBe('/support');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('intent://scan#Intent;end')).toBeNull();
  });
});
