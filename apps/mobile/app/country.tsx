/**
 * Choose the country for help lines, scam reporting and local advice. The phone's region is
 * used until the person picks one. Signed-in people's profiles are updated too.
 */
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '../src/api';
import { authClient } from '../src/auth';
import { deviceCountry, useAppLocale } from '../src/i18n';
import { countryName, countryOptions } from '../src/place';
import { useSettings } from '../src/settings';
import { useTheme } from '../src/theme';
import { Field, Row, Text } from '../src/ui';

/** Letters without accents or case, so "peru" finds "Perú". */
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function CountryScreen() {
  const t = useTranslations('support');
  const m = useTranslations('mobile.country');
  const common = useTranslations('common');
  const theme = useTheme();
  const router = useRouter();
  const { locale } = useAppLocale();
  const { settings, update } = useSettings();
  const session = authClient.useSession();
  const [query, setQuery] = useState('');
  const all = useMemo(() => countryOptions(locale), [locale]);
  const shown = useMemo(() => {
    const q = plain(query.trim());
    return q ? all.filter((c) => plain(c.name).includes(q) || c.code.toLowerCase() === q) : all;
  }, [all, query]);
  const phone = deviceCountry();
  const phoneName = countryName(phone, locale);

  const choose = (code: string | null) => {
    update({ country: code });
    const effective = code ?? phone;
    if (session.data?.user && effective) {
      void api('/me/profile', { method: 'PATCH', json: { country: effective } }).catch(
        () => undefined,
      );
    }
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <Stack.Screen options={{ title: t('country') }} />
      <FlatList
        data={shown}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          gap: 0,
          maxWidth: 640,
          width: '100%',
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 16 }}>
            <Text tone="secondary">{m('lead')}</Text>
            <Field
              label={common('search')}
              value={query}
              onChangeText={setQuery}
              placeholder={m('searchPlaceholder')}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {phoneName && !query ? (
              <View
                style={{
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.borderSubtle,
                  backgroundColor: theme.colors.raised,
                  overflow: 'hidden',
                }}
              >
                <Row
                  first
                  title={m('usePhone')}
                  description={phoneName}
                  selected={settings.country === null}
                  onPress={() => choose(null)}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            style={{
              backgroundColor: theme.colors.raised,
              borderColor: theme.colors.borderSubtle,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderTopWidth: index === 0 ? 1 : 0,
              borderBottomWidth: index === shown.length - 1 ? 1 : 0,
              borderTopLeftRadius: index === 0 ? theme.radius.md : 0,
              borderTopRightRadius: index === 0 ? theme.radius.md : 0,
              borderBottomLeftRadius: index === shown.length - 1 ? theme.radius.md : 0,
              borderBottomRightRadius: index === shown.length - 1 ? theme.radius.md : 0,
              overflow: 'hidden',
            }}
          >
            <Row
              first={index === 0}
              title={item.name}
              selected={settings.country === item.code}
              onPress={() => choose(item.code)}
            />
          </View>
        )}
        ListEmptyComponent={<Text tone="secondary">{m('noMatch')}</Text>}
      />
    </View>
  );
}
