'use client';

import {
  type CommandItem,
  CommandPalette,
  type CommandSection,
  commandMatches,
  Icon,
  type IconName,
  type ModuleKey,
  ModuleMark,
  useCommandShortcut,
} from '@waypoint/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useFilter } from 'react-aria-components';
import { prefillAsk } from '@/lib/ask-handoff';
import styles from './shell.module.css';

/** One place the palette can take someone, worded on the server. */
export interface GoToPlace {
  id: string;
  label: string;
  description?: string;
  href: string;
  /** The module whose mark leads the row; places outside a module take an icon instead. */
  module?: ModuleKey;
  icon?: IconName;
}

export interface GoToGroup {
  id: string;
  title: string;
  places: GoToPlace[];
}

interface GoToControls {
  /** Opens the palette. */
  open: () => void;
  /** How the shortcut is written on this device ("Ctrl+K", "⌘K"), once the page runs. */
  shortcut: string | null;
}

const GoToContext = createContext<GoToControls>({ open: () => {}, shortcut: null });

/** For the buttons that open the palette (the rail, the phone's More sheet). */
export const useGoTo = () => useContext(GoToContext);

/** Everything a person might type to find an item, as the palette itself matches it. */
const searchText = (item: CommandItem) =>
  [item.label, item.description, ...(item.keywords ?? [])].filter(Boolean).join(' ');

const Mark = ({ place }: { place: GoToPlace }) =>
  place.module ? (
    <ModuleMark module={place.module} size="sm" />
  ) : (
    <span className={styles.moreMark} aria-hidden>
      <Icon name={place.icon ?? 'forward'} size={18} />
    </span>
  );

/**
 * The "go to" palette for the whole app: Ctrl+K (Cmd+K on a Mac) anywhere except while
 * typing, or a visible button. It offers every module and the main places inside them. What
 * was typed can also go to Ask as the start of a message: filled in, never sent, and never
 * put in an address.
 */
export function GoToProvider({
  groups,
  canAsk,
  children,
}: {
  groups: GoToGroup[];
  /** Ask needs a session (a guest's will do); signed-out visitors are not offered it. */
  canAsk: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('shell');
  const today = useTranslations('today');
  const common = useTranslations('common');
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const open = useCallback(() => {
    setQuery('');
    setOpen(true);
  }, []);
  const shortcut = useCommandShortcut(open);
  const { contains } = useFilter({ sensitivity: 'base' });

  const places = useMemo<CommandSection[]>(
    () =>
      groups.map((group) => ({
        id: group.id,
        title: group.title,
        items: group.places.map((place) => ({
          id: place.id,
          label: place.label,
          description: place.description,
          href: place.href,
          mark: <Mark place={place} />,
        })),
      })),
    [groups],
  );

  const typed = query.trim();
  const sections = places.slice();
  if (canAsk && typed) {
    const anyPlace = places.some((s) =>
      s.items.some((item) => commandMatches(contains, searchText(item), query)),
    );
    sections.push({
      id: 'ask',
      items: [
        {
          id: 'ask-typed',
          label: t('goToAsk', { query: typed }),
          description: anyPlace ? today('toolAskHint') : t('goToNoMatch'),
          mark: <ModuleMark module="ask" size="sm" />,
          pinned: true,
          onAction: () => {
            prefillAsk(typed.slice(0, 500));
            router.push('/ask');
          },
        },
      ],
    });
  }

  const controls = useMemo(() => ({ open, shortcut }), [open, shortcut]);
  return (
    <GoToContext.Provider value={controls}>
      {children}
      <CommandPalette
        isOpen={isOpen}
        onOpenChange={setOpen}
        title={t('goTo')}
        searchLabel={t('goToSearch')}
        placeholder={t('goToPlaceholder')}
        emptyLabel={t('goToNoMatch')}
        closeLabel={common('close')}
        countLabel={(count) => t('goToCount', { count })}
        inputValue={query}
        onInputChange={setQuery}
        sections={sections}
      />
    </GoToContext.Provider>
  );
}

/**
 * The visible way into the palette: a search-shaped button. `withShortcut` shows the keys
 * beside it (the rail; a phone has no keyboard to press them on). `onBeforeOpen` runs first,
 * to close whatever the button sits in.
 */
export function GoToButton({
  withShortcut = false,
  onBeforeOpen,
}: {
  withShortcut?: boolean;
  onBeforeOpen?: () => void;
}) {
  const t = useTranslations('shell');
  const { open, shortcut } = useGoTo();
  const keys = shortcut?.startsWith('⌘') ? 'Meta+K' : 'Control+K';
  const showKeys = withShortcut && shortcut !== null;
  return (
    <button
      type="button"
      className={styles.goTo}
      onClick={(event) => {
        // Safari, and every browser on an iPhone, does not focus a button that is clicked. The
        // palette gives focus back to whatever had it when it opened, so without this it would
        // hand it to the page itself when it closes, not to this button.
        event.currentTarget.focus({ preventScroll: true });
        onBeforeOpen?.();
        open();
      }}
      aria-haspopup="dialog"
      aria-keyshortcuts={showKeys ? keys : undefined}
    >
      <Icon name="search" size={18} />
      <span className={styles.goToLabel}>{t('goToSearch')}</span>
      {showKeys ? (
        // Told to screen readers by aria-keyshortcuts, so not read out twice.
        <span className={styles.goToKeys} aria-hidden="true">
          <kbd dir="ltr">{shortcut}</kbd>
        </span>
      ) : null}
    </button>
  );
}
