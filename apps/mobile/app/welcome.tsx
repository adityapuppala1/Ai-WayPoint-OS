/**
 * The first screen after installing: what Waypoint is, in the person's language, and the
 * promise that help lines and scam checks work without internet or an account.
 */
import { localeNames } from '@waypoint/i18n';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { useAppLocale } from '../src/i18n';
import { useSettings } from '../src/settings';
import { useTheme } from '../src/theme';
import { Button, Icon, type IconName, LogoMark, Text } from '../src/ui';

function Point({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.signalTint,
        }}
      >
        <Icon name={icon} size={22} weight="fill" color={theme.colors.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold">{title}</Text>
        <Text tone="secondary">{body}</Text>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const w = useTranslations('welcome');
  const m = useTranslations('mobile.welcome');
  const common = useTranslations('common');
  const shell = useTranslations('shell');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale } = useAppLocale();
  const { update } = useSettings();

  const start = () => {
    update({ welcomed: true });
    router.replace('/(tabs)');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
        gap: 28,
        maxWidth: 560,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LogoMark size={44} />
        <Text variant="h4">{common('appName')}</Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="h2">{w('title')}</Text>
        <Text variant="lead" tone="secondary">
          {w('lead')}
        </Text>
      </View>

      <Button
        icon="language"
        onPress={() => router.push('/language')}
        accessibilityHint={shell('language')}
      >
        {`${shell('language')}: ${localeNames[locale]}`}
      </Button>

      <View style={{ gap: 20 }}>
        <Point icon="shield" title={m('offlineTitle')} body={m('offlineBody')} />
        <Point icon="today" title={w('point1Title')} body={w('point1Body')} />
        <Point icon="lock" title={w('point3Title')} body={w('point3Body')} />
      </View>

      <View style={{ gap: 12 }}>
        <Button variant="primary" size="lg" block icon="forward" iconAfter onPress={start}>
          {w('getStarted')}
        </Button>
        <Text variant="small" tone="secondary" center>
          {m('startHint')}
        </Text>
        <Button
          variant="quiet"
          block
          onPress={() => {
            update({ welcomed: true });
            router.replace('/(tabs)');
            router.push('/account');
          }}
        >
          {`${w('haveAccount')} ${common('signIn')}`}
        </Button>
      </View>

      <Text variant="small" tone="muted" center>
        {w('freeNote')}
      </Text>
    </ScrollView>
  );
}
