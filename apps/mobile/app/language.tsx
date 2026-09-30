/**
 * Choose Waypoint's language (or follow the phone's). Arabic turns the whole layout right to
 * left, which on a phone takes a restart; the app offers it straight away.
 */
import { isLocale, type Locale, localeNames, locales, textDirection } from '@waypoint/i18n';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '../src/api';
import { authClient } from '../src/auth';
import { deviceLocale, restartApp, useAppLocale } from '../src/i18n';
import { useSettings } from '../src/settings';
import { useTheme } from '../src/theme';
import { Button, Notice, Panel, Row, Text } from '../src/ui';

export default function LanguageScreen() {
  const shell = useTranslations('shell');
  const m = useTranslations('mobile.language');
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { locale, directionPending } = useAppLocale();
  const session = authClient.useSession();
  const phone = deviceLocale();

  const choose = (next: Locale | null) => {
    update({ locale: next });
    const effective = next ?? phone;
    if (session.data?.user && isLocale(effective)) {
      void api('/me/profile', { method: 'PATCH', json: { locale: effective } }).catch(
        () => undefined,
      );
    }
    // Same direction: done. A new direction needs the restart offered below.
    if (textDirection(effective) === textDirection(locale)) router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        gap: 16,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <Stack.Screen options={{ title: shell('language') }} />
      {directionPending ? (
        <Notice
          tone="info"
          title={m('restartTitle')}
          live
          actions={
            <Button variant="primary" icon="retry" onPress={() => void restartApp()}>
              {m('restartAction')}
            </Button>
          }
        >
          {m('restartBody')}
        </Notice>
      ) : null}
      <Panel flush>
        <Row
          first
          title={m('usePhone')}
          description={localeNames[phone]}
          selected={settings.locale === null}
          onPress={() => choose(null)}
        />
        {locales.map((l) => (
          <Row
            key={l}
            title={localeNames[l]}
            selected={settings.locale === l}
            onPress={() => choose(l)}
            accessibilityLabel={localeNames[l]}
          />
        ))}
      </Panel>
      <View>
        <Text variant="small" tone="secondary">
          {m('note')}
        </Text>
      </View>
    </ScrollView>
  );
}
