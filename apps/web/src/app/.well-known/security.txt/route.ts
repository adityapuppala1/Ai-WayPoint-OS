import { getEnv } from '@waypoint/core/env';
import { securityTxt } from '@waypoint/core/security-txt';

// Built per request: the address and contact are this installation's, read where it runs, and
// the expiry date always lies ahead.
export const dynamic = 'force-dynamic';

/** Where to report a security problem (RFC 9116). */
export function GET(): Response {
  const env = getEnv();
  return new Response(
    securityTxt({
      site: env.WAYPOINT_URL,
      contact: env.WAYPOINT_SECURITY_CONTACT ?? env.WAYPOINT_CONTACT_EMAIL,
    }),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
