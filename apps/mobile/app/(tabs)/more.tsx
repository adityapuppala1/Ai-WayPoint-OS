/**
 * More: your account, language, country and appearance, your privacy choices, and the rest of
 * Waypoint — plans, money, goals, groups and more — on the website.
 */
import { localeNames } from '@waypoint/i18n';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { authClient } from '../../src/auth';
import { restartApp, useAppLocale } from '../../src/i18n';
import { openWebsite } from '../../src/links';
import { countryName, useCountry } from '../../src/place';
import { signOut } from '../../src/session';
import { type ThemePreference, useSettings } from '../../src/settings';
import { useTheme } from '../../src/theme';
import {
  Button,
  Icon,
  type ModuleKey,
  ModuleMark,
  Notice,
  Panel,
  Row,
  Screen,
  Segmented,
  Text,
  useToast,
} from '../../src/ui';

const WEB_MODULES: Array<{ module: ModuleKey; href: string }> = [
  { module: 'path', href: '/path' },
  { module: 'money', href: '/money' },
  { module: 'goals', href: '/goals' },
  { module: 'mind', href: '/mind' },
  { module: 'circles', href: '/circles' },
  { module: 'health', href: '/health' },
  { module: 'civic', href: '/civic' },
  { module: 'surroundings', href: '/surroundings' },
  { module: 'signals', href: '/signals' },
];

export default function MoreScreen() {
  const shell = useTranslations('shell');
  const nav = useTranslations('nav');
  const modules = useTranslations('modules');
  const settingsText = useTranslations('settings');
  const themeText = useTranslations('theme');
  const common = useTranslations('common');
  const support = useTranslations('support');
  const auth = useTranslations('auth');
  const m = useTranslations('mobile.more');
  const language = useTranslations('mobile.language');
  const legal = useTranslations('legal');
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { settings, update } = useSettings();
  const { locale, directionPending } = useAppLocale();
  const { country } = useCountry();
  const session = authClient.useSession();
  const user = session.data?.user as
    | { email?: string | null; isAnonymous?: boolean | null }
    | undefined;
  const guest = Boolean(user?.isAnonymous);
  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen title={shell('more')}>
      {directionPending ? (
        <Notice
          title={language('restartTitle')}
          actions={
            <Button variant="primary" icon="retry" onPress={() => void restartApp()}>
              {language('restartAction')}
            </Button>
          }
        >
          {language('restartBody')}
        </Notice>
      ) : null}
      <Panel title={settingsText('accountTitle')}>
        <Text tone="secondary">
          {!user
            ? m('noAccount')
            : guest
              ? settingsText('guestAccount')
              : settingsText('signedInAs', { email: user.email ?? '' })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {!user || guest ? (
            <>
              <Button
                variant="primary"
                icon="account"
                onPress={() => router.push({ pathname: '/account', params: { mode: 'sign-up' } })}
              >
                {common('createAccount')}
              </Button>
              <Button onPress={() => router.push('/account')}>{common('signIn')}</Button>
            </>
          ) : (
            <Button
              icon="signOut"
              onPress={async () => {
                await signOut();
                toast(auth('signedOut'));
              }}
            >
              {common('signOut')}
            </Button>
          )}
        </View>
      </Panel>

      <Panel title={nav('settings')} flush>
        <Row
          first
          leading={<Icon name="language" size={22} color={theme.colors.textSecondary} />}
          title={shell('language')}
          description={localeNames[locale]}
          onPress={() => router.push('/language')}
        />
        <Row
          leading={<Icon name="place" size={22} color={theme.colors.textSecondary} />}
          title={support('country')}
          description={countryName(country, locale) ?? common('unknownCountry')}
          onPress={() => router.push('/country')}
        />
        {user ? (
          <Row
            leading={<Icon name="lock" size={22} color={theme.colors.textSecondary} />}
            title={settingsText('privacyTitle')}
            description={m('privacyHint')}
            onPress={() => router.push('/privacy')}
          />
        ) : null}
      </Panel>

      <Panel title={themeText('label')}>
        <Segmented<ThemePreference>
          label={themeText('label')}
          value={settings.theme}
          onChange={(value) => update({ theme: value })}
          options={[
            { value: 'light', label: themeText('light'), icon: 'light' },
            { value: 'dark', label: themeText('dark'), icon: 'dark' },
            { value: 'system', label: themeText('system'), icon: 'system' },
          ]}
        />
      </Panel>

      <Panel title={m('websiteTitle')} description={m('websiteLead')} flush>
        {WEB_MODULES.map(({ module, href }, i) => (
          <Row
            key={module}
            first={i === 0}
            leading={<ModuleMark module={module} size="sm" />}
            title={nav(module)}
            description={modules(module as Exclude<ModuleKey, 'support' | 'today'>)}
            trailing={<Icon name="external" size={18} color={theme.colors.textMuted} />}
            onPress={() => void openWebsite(href)}
          />
        ))}
      </Panel>

      <Panel title={m('aboutTitle')} flush>
        <Row
          first
          leading={<Icon name="lock" size={22} color={theme.colors.textSecondary} />}
          title={legal('privacyLink')}
          trailing={<Icon name="external" size={18} color={theme.colors.textMuted} />}
          onPress={() => void openWebsite('/privacy')}
        />
        <Row
          leading={<Icon name="info" size={22} color={theme.colors.textSecondary} />}
          title={legal('termsLink')}
          trailing={<Icon name="external" size={18} color={theme.colors.textMuted} />}
          onPress={() => void openWebsite('/terms')}
        />
        <Row
          leading={<Icon name="web" size={22} color={theme.colors.textSecondary} />}
          title={m('website')}
          trailing={<Icon name="external" size={18} color={theme.colors.textMuted} />}
          onPress={() => void openWebsite('/')}
        />
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderSubtle,
            gap: 4,
          }}
        >
          <Text variant="small" tone="secondary">
            {common('aiDisclosure')}
          </Text>
          <Text variant="meta" tone="muted" tabular>
            {m('version', { version })}
          </Text>
        </View>
      </Panel>
    </Screen>
  );
}
