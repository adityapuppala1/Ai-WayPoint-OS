'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { keepEarlyInput } from '@/lib/early-input';
import { alreadySaved, type Preferences, savePreferences } from '@/lib/preferences';

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>['push']>[1]>;
  }
}

export function Providers({
  children,
  locale,
  closeLabel,
  restore,
}: {
  children: ReactNode;
  locale: string;
  closeLabel: string;
  /** Choices the server took from the saved profile because their cookie was missing. */
  restore: Pick<Preferences, 'locale' | 'theme' | 'lite'>;
}) {
  const router = useRouter();
  // Before the first paint after React takes over, so a field never flashes empty.
  useLayoutEffect(() => keepEarlyInput(), []);
  // After every component's own set-up has run: from here on a press does what it says. The
  // browser tests wait for this mark before they press anything (e2e/fixtures.ts).
  useEffect(() => {
    document.documentElement.setAttribute('data-ready', 'true');
  }, []);
  // Remember the device time zone so reminders and greetings use local time, and put back
  // the cookies for choices the server had to take from the saved profile. One request, and
  // only when something is missing: the server sets the cookies, so they last the year.
  const { locale: savedLocale, theme, lite } = restore;
  useEffect(() => {
    const missing: Preferences = {};
    if (savedLocale) missing.locale = savedLocale;
    if (theme) missing.theme = theme;
    if (lite !== undefined) missing.lite = lite;
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone && !alreadySaved({ timezone })) missing.timezone = timezone;
    } catch {
      // Intl unavailable: the server falls back to the saved time zone, then UTC.
    }
    if (Object.keys(missing).length) void savePreferences(missing);
  }, [savedLocale, theme, lite]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <RouterProvider navigate={(href, options) => router.push(href as Route, options)}>
      <I18nProvider locale={locale}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster closeLabel={closeLabel} />
        </QueryClientProvider>
      </I18nProvider>
    </RouterProvider>
  );
}
