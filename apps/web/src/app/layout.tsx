import '@waypoint/ui/styles.css';
import './app.css';
import { SERVER_ONLY_NAMESPACES, textDirection } from '@waypoint/i18n';
import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/ServiceWorker';
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f5f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0e141c' },
  ],
  colorScheme: 'light dark',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const store = await cookies();
  const theme = store.get('wp-theme')?.value;
  const lite = store.get('wp-lite')?.value === '1';
  const t = await getTranslations('a11y');
  const common = await getTranslations('common');
  // The per-request CSP nonce (src/proxy.ts). React Aria reads it from this meta tag for the
  // few style rules it adds at run time; without it the browser blocks them.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // Only what interactive components need goes to the browser; pages translate on the server.
  const serverOnly: readonly string[] = SERVER_ONLY_NAMESPACES;
  const messages = Object.fromEntries(
    Object.entries(await getMessages()).filter(([namespace]) => !serverOnly.includes(namespace)),
  );
  return (
    <html
      lang={locale}
      dir={textDirection(locale)}
      data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}
      data-lite={lite ? 'true' : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* Browsers hide nonce values after parsing, so the client never sees the same value. */}
        <meta property="csp-nonce" nonce={nonce} suppressHydrationWarning />
      </head>
      <body>
        <a className="wp-skip-link" href="#main">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider messages={messages}>
          <Providers locale={locale} closeLabel={common('close')}>
            {children}
          </Providers>
        </NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
