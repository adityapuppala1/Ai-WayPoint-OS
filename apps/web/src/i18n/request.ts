import { isLocale, LOCALE_COOKIE, loadMessages, resolveLocale } from '@waypoint/i18n';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale: override }) => {
  const locale = isLocale(override)
    ? override
    : resolveLocale(
        (await cookies()).get(LOCALE_COOKIE)?.value,
        (await headers()).get('accept-language'),
      );
  const tzCookie = (await cookies()).get('wp-tz')?.value;
  const timeZone =
    tzCookie && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tzCookie) ? tzCookie : 'UTC';
  return { locale, messages: await loadMessages(locale), timeZone };
});
