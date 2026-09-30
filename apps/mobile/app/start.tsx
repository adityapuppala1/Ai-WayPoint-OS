/**
 * Getting started, in three short steps: where you are, what's going on, and your choices.
 * Everything is optional and every choice is off until turned on. Finishing starts a guest
 * session if there isn't one — no email or password needed.
 */
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { api } from '../src/api';
import { Agreement } from '../src/features/Agreement';
import { deviceTimeZone, useAppLocale } from '../src/i18n';
import { countryName, SITUATION_OPTIONS, START_CONSENTS, useCountry } from '../src/place';
import { ensureSession } from '../src/session';
import { useSettings } from '../src/settings';
import { useTheme } from '../src/theme';
import { Button, Field, Icon, Notice, Panel, Row, SwitchRow, Text } from '../src/ui';

const STEPS = ['place', 'situation', 'privacy'] as const;

export default function StartScreen() {
  const t = useTranslations('start');
  const common = useTranslations('common');
  const situations = useTranslations('situations');
  const consentText = useTranslations('consents');
  const theme = useTheme();
  const router = useRouter();
  const { locale } = useAppLocale();
  const { country } = useCountry();
  const { update } = useSettings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [situation, setSituation] = useState<string | null>(null);
  const [consents, setConsents] = useState<Record<string, boolean>>(
    Object.fromEntries(START_CONSENTS.map((c) => [c, false])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = STEPS[step] ?? 'place';

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const timeZone = deviceTimeZone();
      await ensureSession({ locale, country, timeZone });
      await api('/me/onboarding', {
        json: {
          profile: {
            displayName: name.trim() ? name.trim().slice(0, 60) : null,
            country: country ?? null,
            timezone: timeZone,
            locale,
            situation,
          },
          consents,
        },
      });
      update({ welcomed: true });
      router.back();
    } catch {
      setError(t('error'));
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
      <Stack.Screen options={{ title: t('title') }} />
      <View style={{ gap: 8 }}>
        <Text variant="small" tone="secondary" tabular>
          {common('stepOf', { current: step + 1, total: STEPS.length })}
        </Text>
        <View
          style={{ flexDirection: 'row', gap: 4 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? theme.modules.today.line : theme.colors.borderStrong,
              }}
            />
          ))}
        </View>
      </View>

      {current === 'place' ? (
        <View style={{ gap: 16 }}>
          <Text variant="h3">{t('placeTitle')}</Text>
          <Text tone="secondary">{t('placeLead')}</Text>
          <Panel flush>
            <Row
              first
              leading={<Icon name="place" size={20} color={theme.colors.textSecondary} />}
              title={t('country')}
              description={countryName(country, locale) ?? t('countryPlaceholder')}
              onPress={() => router.push('/country')}
            />
            <Row
              leading={<Icon name="language" size={20} color={theme.colors.textSecondary} />}
              title={t('language')}
              description={common('change')}
              onPress={() => router.push('/language')}
            />
          </Panel>
          <Field
            label={t('name')}
            description={t('nameHint')}
            optionalLabel={common('optional')}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>
      ) : current === 'situation' ? (
        <View style={{ gap: 16 }}>
          <Text variant="h3">{t('situationTitle')}</Text>
          <Text tone="secondary">{t('situationLead')}</Text>
          <Panel flush>
            {SITUATION_OPTIONS.map((s, i) => (
              <Row
                key={s}
                first={i === 0}
                title={situations(s)}
                selected={situation === s}
                onPress={() => setSituation((cur) => (cur === s ? null : s))}
              />
            ))}
          </Panel>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Text variant="h3">{t('privacyTitle')}</Text>
          <Text tone="secondary">{t('privacyLead')}</Text>
          <Panel flush>
            {START_CONSENTS.map((c, i) => (
              <SwitchRow
                key={c}
                first={i === 0}
                label={consentText(c)}
                description={consentText(`${c}Hint`)}
                value={consents[c] ?? false}
                onChange={(on) => setConsents((cur) => ({ ...cur, [c]: on }))}
              />
            ))}
          </Panel>
          <Agreement text={t.rich('agree', { terms: (c) => c, privacy: (c) => c })} />
        </View>
      )}

      {error ? <Notice tone="danger" title={error} live /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            size="lg"
            icon="forward"
            iconAfter
            onPress={() => setStep(step + 1)}
          >
            {common('next')}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            icon="check"
            busy={busy}
            onPress={() => void finish()}
          >
            {busy ? t('finishing') : t('finish')}
          </Button>
        )}
        {step > 0 ? (
          <Button variant="quiet" size="lg" onPress={() => setStep(step - 1)}>
            {common('back')}
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}
