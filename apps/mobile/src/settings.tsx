/**
 * The person's choices on this phone: language, appearance and country for help lines.
 * Loaded before the first screen so the app never flashes in the wrong language.
 */
import type { Locale } from '@waypoint/i18n';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { readJson, writeJson } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** null follows the phone's language. */
  locale: Locale | null;
  theme: ThemePreference;
  /** null follows the phone's region. */
  country: string | null;
  /** The welcome screen has been seen. */
  welcomed: boolean;
}

const KEY = 'waypoint.settings.v1';
export const DEFAULT_SETTINGS: Settings = {
  locale: null,
  theme: 'system',
  country: null,
  welcomed: false,
};

interface SettingsState {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    readJson<Partial<Settings>>(KEY).then((saved) => {
      if (!alive) return;
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void writeJson(KEY, next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
