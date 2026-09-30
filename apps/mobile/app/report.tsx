/**
 * Report a scam so others can be warned. No account needed. Descriptions are redacted before
 * they are stored, and phone numbers or payment ids are kept only as keyed hashes.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { ApiError, api } from '../src/api';
import { useCountry } from '../src/place';
import { useTheme } from '../src/theme';
import { Button, Field, Notice, Panel, Row, Text, useToast } from '../src/ui';

const CATEGORIES = [
  'job',
  'bank-kyc',
  'delivery',
  'investment',
  'crypto',
  'lottery-prize',
  'romance',
  'sextortion',
  'tech-support',
  'impersonation-authority',
  'digital-arrest',
  'loan-app',
  'utility-disconnection',
  'tax-refund',
  'government-scheme',
  'family-emergency',
  'marketplace',
  'rental',
  'charity',
  'phishing-link',
  'sim-swap-otp',
  'qr-code',
  'deepfake-voice',
  'other',
] as const;
type Category = (typeof CATEGORIES)[number];

const isCategory = (v: unknown): v is Category =>
  typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);

export default function ReportScreen() {
  const t = useTranslations('shield');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ category?: string; hosts?: string }>();
  const { country } = useCountry();
  const hosts = (params.hosts ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 10);
  const [category, setCategory] = useState<Category>(
    isCategory(params.category) ? params.category : 'other',
  );
  const [choosing, setChoosing] = useState(false);
  const [description, setDescription] = useState('');
  const [identifiers, setIdentifiers] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const lost = Number(amount.replace(/[^\d.]/g, ''));
    try {
      await api('/shield/reports', {
        json: {
          category,
          description: description.trim() || undefined,
          country: country ?? undefined,
          identifiers: identifiers
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length >= 3)
            .slice(0, 10),
          amountLost: amount.trim() && Number.isFinite(lost) ? lost : undefined,
          urls: hosts.length ? hosts : undefined,
        },
      });
      toast(t('reportThanks'));
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiError && err.offline
          ? errors('network')
          : err instanceof ApiError && err.status === 429
            ? errors('tooMany')
            : errors('generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 40,
        gap: 20,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('reportFormTitle') }} />
      <Text tone="secondary">{t('reportFormLead')}</Text>
      {hosts.length ? (
        <Text variant="small" tone="secondary">
          {t('reportLinks', { hosts: hosts.join(', ') })}
        </Text>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text weight="medium">{t('category')}</Text>
        <Panel flush>
          {(choosing ? CATEGORIES : [category]).map((c, i) => (
            <Row
              key={c}
              first={i === 0}
              title={t(`categories.${c}`)}
              selected={choosing ? c === category : undefined}
              trailing={choosing ? undefined : <Text tone="secondary">{common('change')}</Text>}
              onPress={() => {
                if (choosing) setCategory(c);
                setChoosing((open) => !open);
              }}
            />
          ))}
        </Panel>
      </View>

      <Field
        label={t('description')}
        description={t('descriptionHint')}
        optionalLabel={common('optional')}
        value={description}
        onChangeText={setDescription}
        multiline
        rows={4}
        maxLength={2000}
      />
      <Field
        label={t('identifiers')}
        description={t('identifiersHint')}
        optionalLabel={common('optional')}
        value={identifiers}
        onChangeText={setIdentifiers}
        multiline
        rows={3}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        label={t('amountLost')}
        optionalLabel={common('optional')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      {error ? <Notice tone="danger" title={error} live /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="primary" size="lg" busy={busy} onPress={() => void submit()}>
          {t('submitReport')}
        </Button>
        <Button variant="quiet" size="lg" onPress={() => router.back()}>
          {common('cancel')}
        </Button>
      </View>
    </ScrollView>
  );
}
