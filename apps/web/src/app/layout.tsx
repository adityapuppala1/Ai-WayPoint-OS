import '@waypoint/ui/styles.css';
import './app.css';
import { maintenance as platform } from '@waypoint/api';
import { isStaffRole, pageOpenDuringMaintenance } from '@waypoint/core/console';
import { formattingLocale, SERVER_ONLY_NAMESPACES, textDirection } from '@waypoint/i18n';
import { hexRoles } from '@waypoint/tokens';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/ServiceWorker';
import { MaintenanceScreen } from '@/components/shell/Maintenance';
import { EARLY_INPUT_SCRIPT } from '@/lib/early-input';
import { savedPreferences } from '@/lib/saved-preferences';
import { getViewer } from '@/lib/server';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const base = process.env.WAYPOINT_URL ?? 'http://localhost:3000';
  return {
    metadataBase: new URL(base),
    title: { default: `${t('title')} — ${t('tagline')}`, template: `%s · ${t('title')}` },
    description: t('description'),
    applicationName: t('title'),
    appleWebApp: { capable: true, title: t('title'), statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  // The page background (the canvas token), so the browser's own bars match the page.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: hexRoles('light').canvas },
    { media: '(prefers-color-scheme: dark)', color: hexRoles('dark').canvas },
  ],
  colorScheme: 'light dark',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const { theme, lite, restore } = await savedPreferences();
  const t = await getTranslations('a11y');
  const common = await getTranslations('common');
  const shell = await getTranslations('shell');
  // The per-request CSP nonce (src/proxy.ts). React Aria reads it from this meta tag for the
  // few style rules it adds at run time; without it the browser blocks them.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // Only what interactive components need goes to the browser; pages translate on the server.
  const serverOnly: readonly string[] = SERVER_ONLY_NAMESPACES;
  const messages = Object.fromEntries(
    Object.entries(await getMessages()).filter(([namespace]) => !serverOnly.includes(namespace)),
  );
  // Interactive components are drawn here and again in the browser, so they format with their
  // digits named (formattingLocale): engines disagree on Arabic's, and React throws away a page
  // drawn two ways. next-intl types this as one of the languages; client components read the
  // language with useLanguage() (src/lib/language.ts), and a test keeps it that way.
  const clientLocale = formattingLocale(locale) as typeof locale;
  // Maintenance: every page but help, sign-in and the legal pages is closed to anyone not on
  // the staff. A prefetch skips the proxy and comes without a path: treated as open, so a
  // prefetched Get help now never shows the notice (the API refuses what is closed anyway).
  const notice = platform.platformNotice();
  const path = (await headers()).get('x-wp-path');
  const closed =
    notice.maintenance.active &&
    path !== null &&
    !pageOpenDuringMaintenance(path) &&
    !isStaffRole((await getViewer())?.user.role);
  return (
    <html
      lang={locale}
      dir={textDirection(locale)}
      data-theme={theme === 'system' ? undefined : theme}
      data-lite={lite ? 'true' : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* Browsers hide nonce values after parsing, so the client never sees the same value. */}
        <meta property="csp-nonce" nonce={nonce} suppressHydrationWarning />
        {/* First thing in the page: notes what is typed before the rest of the script arrives
            (src/lib/early-input.ts). */}
        <script nonce={nonce} suppressHydrationWarning>
          {EARLY_INPUT_SCRIPT}
        </script>
      </head>
      <body>
        {/* Shown only by a browser too old for the stylesheet, which then shows the page as
            plain text: the stylesheet hides this, and such a browser skips the stylesheet
            (.wp-old-browser in packages/ui/src/styles/reset.css; the plain layout it gets
            instead is at the end of index.css there). */}
        <p className="wp-old-browser">
          {shell('oldBrowser')} <a href="/support">{shell('help')}</a>
        </p>
        <a className="wp-skip-link" href="#main">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider locale={clientLocale} messages={messages}>
          <Providers locale={clientLocale} closeLabel={common('close')} restore={restore}>
            {closed ? (
              <MaintenanceScreen
                message={notice.maintenance.message}
                until={notice.maintenance.until}
              />
            ) : (
              children
            )}
          </Providers>
        </NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
