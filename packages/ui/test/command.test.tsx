/**
 * The "go to" palette: how it matches what is typed (in every script, through React Aria's
 * language-aware filter) and when its keyboard shortcut fires. The dialog itself needs a
 * browser and is checked in apps/web/e2e/design.spec.ts.
 */

import { I18nProvider, useFilter } from 'react-aria-components';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandPalette, commandMatches, commandShortcutHint, isCommandShortcut } from '../src';

/** Asks the real filter, in a given language, whether `text` answers `query`. */
function matches(locale: string, text: string, query: string): boolean {
  function Probe() {
    const { contains } = useFilter({ sensitivity: 'base' });
    return <i>{String(commandMatches(contains, text, query))}</i>;
  }
  return renderToStaticMarkup(
    <I18nProvider locale={locale}>
      <Probe />
    </I18nProvider>,
  ).includes('true');
}

describe('matching what is typed', () => {
  it('finds a word anywhere in the text, whatever its case or accents', () => {
    expect(matches('en', 'Money Budget, runway and money safety.', 'RUNWAY')).toBe(true);
    expect(matches('fr', 'Économies', 'economies')).toBe(true);
    expect(matches('es', 'Análisis', 'analisis')).toBe(true);
    expect(matches('pt', 'Saúde', 'saude')).toBe(true);
    expect(matches('en', 'Money', 'path')).toBe(false);
  });

  it('follows the language: in Spanish ñ is a letter of its own, not an n with a mark', () => {
    expect(matches('es', 'Señales', 'señal')).toBe(true);
    expect(matches('es', 'Señales', 'senal')).toBe(false);
  });

  it('asks for every word typed, in any order', () => {
    expect(matches('en', 'Make a plan Your path', 'plan make')).toBe(true);
    expect(matches('en', 'Make a plan Your path', 'plan money')).toBe(false);
  });

  it('shows everything while nothing is typed', () => {
    expect(matches('en', 'Money', '')).toBe(true);
    expect(matches('en', 'Money', '   ')).toBe(true);
  });

  it('works in Arabic, with or without the marks over the letters', () => {
    expect(matches('ar', 'المال', 'مال')).toBe(true);
    // Hamza on the alef is often left out when typing.
    expect(matches('ar', 'الأهداف', 'الاهداف')).toBe(true);
    expect(matches('ar', 'المال', 'صحة')).toBe(false);
  });

  it('works in Hindi', () => {
    expect(matches('hi', 'पैसा बजट और बचत', 'बजट')).toBe(true);
    expect(matches('hi', 'पैसा', 'सेहत')).toBe(false);
  });
});

describe('the keyboard shortcut', () => {
  const press = (over: Record<string, unknown> = {}) => ({
    key: 'k',
    code: 'KeyK',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    target: { tagName: 'BODY', isContentEditable: false },
    ...over,
  });

  it('is Ctrl+K, or Cmd+K on a Mac', () => {
    expect(isCommandShortcut(press())).toBe(true);
    expect(isCommandShortcut(press({ ctrlKey: false, metaKey: true }))).toBe(true);
    expect(isCommandShortcut(press({ key: 'K' }))).toBe(true);
    expect(isCommandShortcut(press({ ctrlKey: false }))).toBe(false);
    expect(isCommandShortcut(press({ key: 'j', code: 'KeyJ' }))).toBe(false);
  });

  it('is not some other shortcut that also holds K', () => {
    expect(isCommandShortcut(press({ shiftKey: true }))).toBe(false);
    // Ctrl+Alt is how some keyboards type a third letter on a key (AltGr).
    expect(isCommandShortcut(press({ altKey: true }))).toBe(false);
    expect(isCommandShortcut(press({ metaKey: true }))).toBe(false);
  });

  it('works on a keyboard set to Arabic or Hindi, where the K key types another letter', () => {
    expect(isCommandShortcut(press({ key: 'ن' }))).toBe(true);
    expect(isCommandShortcut(press({ key: 'क' }))).toBe(true);
    // A Latin layout that moves K elsewhere is believed: the letter typed decides.
    expect(isCommandShortcut(press({ key: 't', code: 'KeyK' }))).toBe(false);
    expect(isCommandShortcut(press({ key: 'k', code: 'KeyV' }))).toBe(true);
  });

  it('does not fire while the person is typing in a field', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT'])
      expect(isCommandShortcut(press({ target: { tagName } })), tagName).toBe(false);
    expect(isCommandShortcut(press({ target: { tagName: 'DIV', isContentEditable: true } }))).toBe(
      false,
    );
    expect(isCommandShortcut(press({ target: null }))).toBe(true);
  });

  it('does not stack the palette on another open dialog, but a toast is not one', () => {
    // What `closest` finds from the focused element: the dialog around it, or nothing.
    const inside = (dialog: { modal?: string } | null) => ({
      tagName: 'A',
      closest: () =>
        dialog && { getAttribute: (name: string) => (name === 'aria-modal' ? dialog.modal : null) },
    });
    expect(isCommandShortcut(press({ target: inside({}) }))).toBe(false);
    expect(isCommandShortcut(press({ target: inside({ modal: 'true' }) }))).toBe(false);
    // React Aria's toasts are alert dialogs that say they are not modal.
    expect(isCommandShortcut(press({ target: inside({ modal: 'false' }) }))).toBe(true);
    expect(isCommandShortcut(press({ target: inside(null) }))).toBe(true);
  });

  it('ignores a held key, a key already handled and a letter still being composed', () => {
    expect(isCommandShortcut(press({ repeat: true }))).toBe(false);
    expect(isCommandShortcut(press({ defaultPrevented: true }))).toBe(false);
    expect(isCommandShortcut(press({ isComposing: true }))).toBe(false);
  });

  it('can be another letter', () => {
    expect(isCommandShortcut(press({ key: 'p', code: 'KeyP' }), 'p')).toBe(true);
    expect(isCommandShortcut(press(), 'p')).toBe(false);
  });

  it('is written the way the keyboard in front of the person shows it', () => {
    expect(commandShortcutHint('k', 'MacIntel')).toBe('⌘K');
    expect(commandShortcutHint('k', 'iPhone')).toBe('⌘K');
    expect(commandShortcutHint('k', 'Win32')).toBe('Ctrl+K');
    expect(commandShortcutHint('k', 'Linux x86_64')).toBe('Ctrl+K');
    expect(commandShortcutHint('p', 'Android')).toBe('Ctrl+P');
  });
});

describe('CommandPalette', () => {
  it('puts nothing on the page until it is opened', () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        isOpen={false}
        onOpenChange={() => {}}
        title="Go to"
        searchLabel="Search Waypoint"
        emptyLabel="Nothing matches."
        closeLabel="Close"
        sections={[{ id: 'modules', items: [{ id: 'money', label: 'Money', href: '/money' }] }]}
      />,
    );
    expect(html).toBe('');
  });
});
