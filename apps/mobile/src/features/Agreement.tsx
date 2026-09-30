/**
 * "By creating an account, you agree to the terms of use…", with both documents one tap away.
 * The links are real buttons rather than words inside the sentence, so screen readers and
 * fingers can reach each of them.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { openWebsite } from '../links';
import { Button, Text } from '../ui';

export function Agreement({ text }: { text: ReactNode }) {
  const legal = useTranslations('legal');
  return (
    <View style={{ gap: 4 }}>
      <Text variant="small" tone="secondary">
        {text}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          variant="quiet"
          size="sm"
          icon="external"
          onPress={() => void openWebsite('/terms')}
        >
          {legal('termsLink')}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          icon="external"
          onPress={() => void openWebsite('/privacy')}
        >
          {legal('privacyLink')}
        </Button>
      </View>
    </View>
  );
}
