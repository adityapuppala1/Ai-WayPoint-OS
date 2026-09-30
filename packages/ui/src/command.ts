/**
 * The plain rules behind the "go to" palette: what counts as a match for what was typed,
 * and what counts as its keyboard shortcut. Kept apart from the component so both can be
 * used, and tested, without a browser.
 */

/**
 * Whether `text` answers `query`: every word typed must be found somewhere in it, in any
 * order. `contains` decides what "found" means; pass React Aria's language-aware filter
 * (`useFilter({ sensitivity: 'base' }).contains`), which knows that case and accents do not
 * matter and works for Arabic and Devanagari, where lower-casing does nothing.
 */
export function commandMatches(
  contains: (text: string, part: string) => boolean,
  text: string,
  query: string,
): boolean {
  const words = query.split(/\s+/).filter(Boolean);
  return words.every((word) => contains(text, word));
}

/** The parts of a key press the shortcut looks at (a browser's KeyboardEvent has them all). */
export interface ShortcutEvent {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

/** Fields a person types in: there, Ctrl+K and Cmd+K belong to the text being edited. */
function isTyping(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  return (
    element.isContentEditable === true ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(element.tagName ?? '').toUpperCase())
  );
}

/**
 * Inside another open dialog (the phone's More sheet, a confirmation): the palette is not
 * stacked on top of it. A toast is an alert dialog too, but one that says it is not modal.
 */
function inDialog(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as {
    closest?: (selector: string) => { getAttribute(name: string): string | null } | null;
  };
  if (typeof element.closest !== 'function') return false;
  const dialog = element.closest('[role="dialog"], [role="alertdialog"]');
  return Boolean(dialog) && dialog?.getAttribute('aria-modal') !== 'false';
}

/**
 * Whether a key press is the palette's shortcut: Ctrl+K, or Cmd+K on a Mac (`letter` can
 * change the K). Not while typing in a field or inside another dialog, not with Shift or Alt
 * also held, and not for a key that is being held down or was already handled.
 */
export function isCommandShortcut(event: ShortcutEvent, letter = 'k'): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;
  // Exactly one of the two: Ctrl on Windows, Linux and Android keyboards, Cmd on a Mac.
  if (event.ctrlKey === event.metaKey || event.altKey || event.shiftKey) return false;
  // The letter typed decides. A keyboard set to Arabic or Hindi types another letter with
  // the same key, so there the key's position is used instead.
  const typed = /^[a-z]$/i.test(event.key)
    ? event.key.toLowerCase()
    : event.code?.startsWith('Key')
      ? event.code.slice(3).toLowerCase()
      : '';
  if (typed !== letter.toLowerCase()) return false;
  return !isTyping(event.target) && !inDialog(event.target);
}

/** How the shortcut is written on this device: "⌘K" on Apple keyboards, "Ctrl+K" elsewhere. */
export function commandShortcutHint(letter = 'k', platform?: string): string {
  const name =
    platform ??
    (typeof navigator === 'undefined'
      ? ''
      : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
          ?.platform ?? navigator.platform));
  const key = letter.toUpperCase();
  return /mac|iphone|ipad|ipod/i.test(name) ? `⌘${key}` : `Ctrl+${key}`;
}
