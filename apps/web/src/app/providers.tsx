'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nProvider, RouterProvider } from 'react-aria-components';

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>['push']>[1]>;
  }
}

export function Providers({
  children,
  locale,
  closeLabel,
}: {
  children: ReactNode;
  locale: string;
  closeLabel: string;
}) {
  const router = useRouter();
  // Remember the device time zone so reminders and greetings use local time.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.split('; ').some((c) => c === `wp-tz=${encodeURIComponent(tz)}`)) {
        // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie read on the server
        document.cookie = `wp-tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {
      // Intl or cookies unavailable: the server falls back to UTC.
    }
  }, []);
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
