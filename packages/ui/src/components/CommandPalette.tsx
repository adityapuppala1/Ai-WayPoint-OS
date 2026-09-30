'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  Text,
  useFilter,
} from 'react-aria-components';
import { commandMatches, commandShortcutHint, isCommandShortcut } from '../command';
import styles from './CommandPalette.module.css';
import { SearchField } from './Field';
import { Dialog } from './Overlay';

export interface CommandItem {
  /** Unique among every item in the palette. */
  id: string;
  label: string;
  description?: string;
  /** A picture beside the label: a ModuleMark or an Icon. The label says what it is. */
  mark?: ReactNode;
  /** Where choosing the item leads. It goes through the app's router. */
  href?: string;
  /** Or what choosing it does. */
  onAction?: () => void;
  /** Other words a person may type to find this, already translated. */
  keywords?: readonly string[];
  /** Stays in the list whatever is typed (for a row made from the typed text itself). */
  pinned?: boolean;
}

export interface CommandSection {
  id: string;
  /** A heading for the group. Without it the items stand directly in the list. */
  title?: string;
  items: readonly CommandItem[];
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's name, shown as its heading: "Go to". */
  title: string;
  /** The search field's name for screen readers. */
  searchLabel: string;
  placeholder?: string;
  sections: readonly CommandSection[];
  /** One sentence for when nothing matches. */
  emptyLabel: ReactNode;
  closeLabel: string;
  /** Follow what is typed (to build a pinned row from it). Both or neither. */
  inputValue?: string;
  onInputChange?: (value: string) => void;
  /** Read out as the list changes, for people who cannot see it shrink: "5 results". */
  countLabel?: (count: number) => string;
}

/** Everything a person might type to find an item. */
const searchText = (item: CommandItem) =>
  [item.label, item.description, ...(item.keywords ?? [])].filter(Boolean).join(' ');

/**
 * A "go to" dialog: type a few letters, choose a place or an action. Arrow keys move through
 * the list while the caret stays in the field, Enter chooses, Escape clears the field and
 * then closes. On a phone it is a sheet that rests on top of the keyboard.
 *
 * Opening it is the caller's job: a visible button, and `useCommandShortcut` for Ctrl+K.
 * Every piece of text is passed in, already translated.
 */
export function CommandPalette({
  isOpen,
  onOpenChange,
  title,
  closeLabel,
  ...list
}: CommandPaletteProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      closeLabel={closeLabel}
      variant="palette"
    >
      {/* Its own component, so what was typed is forgotten each time the palette closes. */}
      <CommandList {...list} title={title} onClose={() => onOpenChange(false)} />
    </Dialog>
  );
}

function CommandList({
  title,
  searchLabel,
  placeholder,
  sections,
  emptyLabel,
  inputValue,
  onInputChange,
  countLabel,
  onClose,
}: Omit<CommandPaletteProps, 'isOpen' | 'onOpenChange' | 'closeLabel'> & { onClose: () => void }) {
  // The reader's language decides what matches: case and accents never matter, and Arabic
  // and Devanagari (where there is no lower case) are compared letter by letter.
  const { contains } = useFilter({ sensitivity: 'base' });
  const [typed, setTyped] = useState('');
  const query = inputValue ?? typed;
  const pinned = useMemo(
    () => new Set(sections.flatMap((s) => s.items.filter((i) => i.pinned).map((i) => i.id))),
    [sections],
  );
  const count = sections.reduce(
    (n, s) =>
      n + s.items.filter((i) => i.pinned || commandMatches(contains, searchText(i), query)).length,
    0,
  );
  const row = (item: CommandItem) => (
    <MenuItem
      key={item.id}
      id={item.id}
      href={item.href}
      onAction={item.onAction}
      textValue={searchText(item)}
      className={styles.item}
    >
      {item.mark ? <span className={styles.mark}>{item.mark}</span> : null}
      <span className={styles.text}>
        <Text slot="label" className={styles.label}>
          {item.label}
        </Text>
        {item.description ? (
          <Text slot="description" className={styles.description}>
            {item.description}
          </Text>
        ) : null}
      </span>
    </MenuItem>
  );
  return (
    <div className={styles.palette}>
      <Autocomplete
        inputValue={query}
        onInputChange={(value) => {
          setTyped(value);
          onInputChange?.(value);
        }}
        filter={(text, input, node) =>
          pinned.has(String(node.key)) || commandMatches(contains, text, input)
        }
      >
        <SearchField label={searchLabel} placeholder={placeholder} autoFocus />
        <Menu
          aria-label={title}
          className={styles.list}
          onClose={onClose}
          renderEmptyState={() => <p className={styles.empty}>{emptyLabel}</p>}
        >
          {sections.map((section) =>
            section.title ? (
              <MenuSection key={section.id} id={section.id} className={styles.section}>
                <Header className={styles.heading}>{section.title}</Header>
                {section.items.map(row)}
              </MenuSection>
            ) : (
              section.items.map(row)
            ),
          )}
        </Menu>
      </Autocomplete>
      {countLabel ? (
        <span className="wp-visually-hidden" role="status">
          {countLabel(count)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Listens for the palette's shortcut (Ctrl+K, or Cmd+K on a Mac) anywhere on the page and
 * calls `onTrigger`. It does not fire while the person is typing in a field, where those
 * keys belong to the text. Returns how the shortcut is written on this device ("⌘K",
 * "Ctrl+K") once the page is running, to show beside the button that opens the palette.
 */
export function useCommandShortcut(
  onTrigger: () => void,
  { letter = 'k', isDisabled = false }: { letter?: string; isDisabled?: boolean } = {},
): string | null {
  const trigger = useRef(onTrigger);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    trigger.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    // Only known in the browser, so it is filled in after the page has started.
    setHint(commandShortcutHint(letter));
    if (isDisabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCommandShortcut(event, letter)) return;
      // Browsers use the same keys (Firefox: its search bar).
      event.preventDefault();
      trigger.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [letter, isDisabled]);

  return hint;
}
