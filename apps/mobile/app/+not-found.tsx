/** A link that leads nowhere (an old notification, a mistyped waypoint:// link). */
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { useTheme } from '../src/theme';
import { Button, Text } from '../src/ui';

export default function NotFound() {
  const t = useTranslations('errors');
  const theme = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        gap: 16,
        justifyContent: 'center',
        backgroundColor: theme.colors.canvas,
      }}
    >
      <Stack.Screen options={{ title: '' }} />
      <Text variant="h3">{t('notFoundTitle')}</Text>
      <Text tone="secondary">{t('notFoundBody')}</Text>
      <Button variant="primary" icon="today" onPress={() => router.replace('/(tabs)')}>
        {t('backToToday')}
      </Button>
    </View>
  );
}
