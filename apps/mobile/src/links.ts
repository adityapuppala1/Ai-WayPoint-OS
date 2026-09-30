/**
 * Leaving the app: calls and texts go to the phone's own apps, websites open in an in-app
 * browser (the person's cookies and passwords stay with their browser, not with Waypoint), and
 * Waypoint's own pages open in the app when it has them, otherwise on the website.
 */
import { isInternalPath } from '@waypoint/core/paths';
import * as Linking from 'expo-linking';
import { type Href, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { WEB_URL } from './config';

/** Waypoint's pages that the app has its own screens for. */
const APP_SCREENS: Record<string, Href> = {
  '/': '/(tabs)',
  '/support': '/(tabs)/help',
  '/shield': '/(tabs)/shield',
  '/ask': '/(tabs)/ask',
  '/start': '/start',
  '/settings': '/(tabs)/more',
  '/settings/privacy': '/privacy',
  '/sign-in': '/account',
};

/** Opens one of Waypoint's own pages: in the app if it has a screen for it, else the website. */
export async function openPath(path: string): Promise<void> {
  const screen = APP_SCREENS[path.split(/[?#]/)[0] ?? ''];
  if (screen) {
    router.push(screen);
    return;
  }
  await openWebsite(path);
}

/** A full address on the Waypoint website for one of its own paths ("/money"). */
export function websiteUrl(path: string): string {
  return `${WEB_URL}${isInternalPath(path) ? path : '/'}`;
}

/** Opens tel:, sms:, mailto: and WhatsApp links in the phone's apps; web pages in the browser. */
export async function openLink(href: string): Promise<void> {
  if (isInternalPath(href)) return openPath(href);
  if (/^https?:\/\//i.test(href) && !/^https:\/\/wa\.me\//i.test(href)) {
    if (Platform.OS === 'web') {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    await WebBrowser.openBrowserAsync(href, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    }).catch(() => Linking.openURL(href));
    return;
  }
  if (/^(tel|sms|mailto):|^https:\/\/wa\.me\//i.test(href)) {
    await Linking.openURL(href).catch(() => undefined);
  }
}

/** One of Waypoint's own pages, on the website. */
export async function openWebsite(path: string): Promise<void> {
  const url = websiteUrl(path);
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}

/** Digits, + * and #, as a tel: link needs (# escaped). */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+*#]/g, '').replace(/#/g, '%23')}`;
}
