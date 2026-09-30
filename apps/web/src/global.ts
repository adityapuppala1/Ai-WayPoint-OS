import type { Locale } from '@waypoint/i18n';
import type messages from '../../../packages/i18n/messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
