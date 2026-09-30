import type { Locale, Messages } from '@waypoint/i18n';

declare module 'use-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
