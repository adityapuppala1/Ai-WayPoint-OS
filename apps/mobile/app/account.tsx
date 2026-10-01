/**
 * Sign in, or create a free account. A guest's plans, checks and conversations come with
 * them into the new account. The session is kept in the phone's secure keystore.
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, type TextInput, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { ApiError } from '../src/api';
import { Agreement } from '../src/features/Agreement';
import { openWebsite } from '../src/links';
import { signInWithEmail, signUpWithEmail } from '../src/session';
import { useSettings } from '../src/settings';
import { useTheme } from '../src/theme';
import { Button, Field, Notice, Text, useToast } from '../src/ui';

export default function AccountScreen() {
  const t = useTranslations('auth');
  const m = useTranslations('mobile.account');
  const errors = useTranslations('errors');
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { update } = useSettings();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(
    params.mode === 'sign-up' ? 'sign-up' : 'sign-in',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; help?: string } | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const signUp = mode === 'sign-up';

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      if (signUp) await signUpWithEmail(name, email, password);
      else await signInWithEmail(email, password);
      update({ welcomed: true });
      toast(signUp ? m('created') : m('signedIn'));
      router.back();
    } catch (err) {
      // A wrong password, an unknown address and an address not confirmed yet get the same
      // answer from the API, so the message covers all three (the last also emails a link).
      setError(
        err instanceof ApiError && err.offline
          ? { title: errors('network') }
          : signUp
            ? { title: t('signUpFailed') }
            : err instanceof ApiError && err.status === 429
              ? { title: errors('tooMany') }
              : err instanceof ApiError && err.status === 401
                ? { title: t('failed'), help: t('failedHelp', { email: email.trim() }) }
                : { title: errors('generic') },
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
        maxWidth: 560,
        width: '100%',
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: signUp ? t('signUpTitle') : t('signInTitle') }} />
      <Text variant="lead" tone="secondary">
        {signUp ? t('signUpLead') : t('signInLead')}
      </Text>
      {signUp ? (
        <Field
          label={t('name')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          maxLength={60}
          returnKeyType="next"
        />
      ) : null}
      <Field
        label={t('email')}
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        textContentType={signUp ? 'username' : 'emailAddress'}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        label={t('password')}
        description={signUp ? t('passwordHint') : undefined}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={signUp ? 'new-password' : 'current-password'}
        textContentType={signUp ? 'newPassword' : 'password'}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      {error ? (
        <Notice tone={error.help ? 'caution' : 'danger'} title={error.title} live>
          {error.help}
        </Notice>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        block
        busy={busy}
        disabled={!email.trim() || (signUp ? password.length < 10 : !password)}
        onPress={() => void submit()}
      >
        {signUp ? t('submitSignUp') : t('submitSignIn')}
      </Button>
      {signUp ? (
        <Agreement text={t.rich('agree', { terms: (c) => c, privacy: (c) => c })} />
      ) : (
        <Button
          variant="quiet"
          size="sm"
          icon="external"
          onPress={() => void openWebsite('/forgot-password')}
        >
          {t('forgotLink')}
        </Button>
      )}
      <View style={{ gap: 6, alignItems: 'flex-start' }}>
        <Text tone="secondary">{signUp ? t('haveAccount') : t('noAccount')}</Text>
        <Button
          variant="quiet"
          onPress={() => {
            setMode(signUp ? 'sign-in' : 'sign-up');
            setError(null);
          }}
        >
          {signUp ? t('submitSignIn') : t('signUpTitle')}
        </Button>
      </View>
    </ScrollView>
  );
}
