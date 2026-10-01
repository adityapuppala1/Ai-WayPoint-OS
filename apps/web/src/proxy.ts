import { type NextRequest, NextResponse, type ProxyConfig } from 'next/server';

/**
 * Runs before every page request: sets a per-request CSP nonce and strict security
 * headers. Auth is NOT decided here (pages and the API check sessions themselves);
 * this only does cheap work that must happen before rendering.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  // Read at run time, not build time: the same image can be served at any address. Behind a
  // proxy that ends TLS the request itself looks like plain HTTP, so the public address decides.
  const publicHttps = (process.env.WAYPOINT_URL ?? '').startsWith('https://');
  const https = request.nextUrl.protocol === 'https:' || publicHttps;

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // React sets CSS custom properties through style attributes (e.g. route line colours).
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    // Weather and air quality are fetched straight from the browser, so the server never sees location.
    `connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com${dev ? ' ws:' : ''}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Which page this is, for the layout (maintenance closes some pages and not others).
  // Always set here, so a visitor can never send their own.
  requestHeaders.set('x-wp-path', request.nextUrl.pathname);
  // Next reads the nonce from the request CSP header and applies it to its own scripts.
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (publicHttps && !dev)
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  return response;
}

export const config: ProxyConfig = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|icons|brand|landing|fonts|sw.js|offline.html|manifest.webmanifest|robots.txt|sitemap.xml|.well-known).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
