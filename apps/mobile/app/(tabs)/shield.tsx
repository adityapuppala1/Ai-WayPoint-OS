/**
 * Scam Shield. The check runs on the phone — the same rules as the website, in all seven
 * languages — so it works offline and nothing leaves the phone. A second opinion from
 * Waypoint online (and its AI check, redacted) is one tap away, and reporting helps warn
 * others.
 */
import type { ShieldCheck } from '@waypoint/api/client';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { ApiError, api } from '../../src/api';
import { type ShieldOutcome, ShieldResultView } from '../../src/features/ShieldResult';
import { useAppLocale } from '../../src/i18n';
import { useCountry } from '../../src/place';
import { useOnline } from '../../src/remote';
import { Button, Field, Notice, Panel, Screen, Text } from '../../src/ui';

type Engine = typeof import('@waypoint/core/shield');
let engine: Promise<Engine> | null = null;
/** The rules are compiled the first time they're needed, not when the app starts. */
const loadEngine = () => {
  engine ??= import('@waypoint/core/shield');
  return engine;
};

const MAX = 4000;

export default function ShieldScreen() {
  const t = useTranslations('shield');
  const m = useTranslations('mobile.shield');
  const errors = useTranslations('errors');
  const router = useRouter();
  const { locale } = useAppLocale();
  const { country } = useCountry();
  const online = useOnline();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'phone' | 'online' | null>(null);
  const [outcome, setOutcome] = useState<ShieldOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checked = useRef('');

  const checkOnPhone = async (value = text) => {
    const input = value.trim();
    if (!input) return;
    setBusy('phone');
    setError(null);
    try {
      const { checkMessage } = await loadEngine();
      const result = checkMessage({ text: input, country: country ?? undefined, locale });
      checked.current = input;
      setOutcome({ result, where: 'phone' });
    } catch {
      setError(errors('generic'));
    } finally {
      setBusy(null);
    }
  };

  const checkOnline = async () => {
    const input = checked.current || text.trim();
    if (!input) return;
    setBusy('online');
    setError(null);
    try {
      const res = await api<ShieldCheck>('/shield/check', {
        json: { text: input, country: country ?? undefined, locale, aiConsent: true },
        timeoutMs: 30_000,
      });
      setOutcome({
        result: res.result as ShieldOutcome['result'],
        where: 'online',
        ai: res.ai,
        seenBefore: res.seenBefore,
      });
    } catch (err) {
      setError(
        err instanceof ApiError && err.offline
          ? m('offlineSecondOpinion')
          : err instanceof ApiError && err.status === 429
            ? errors('tooMany')
            : errors('generic'),
      );
    } finally {
      setBusy(null);
    }
  };

  const paste = async () => {
    const value = await Clipboard.getStringAsync().catch(() => '');
    if (!value) return;
    const next = value.slice(0, MAX);
    setText(next);
    setOutcome(null);
    void checkOnPhone(next);
  };

  const clear = () => {
    setText('');
    setOutcome(null);
    setError(null);
    checked.current = '';
  };

  const report = () => {
    if (!outcome) return;
    const hosts = [...new Set(outcome.result.urls.map((u) => u.host))].slice(0, 10);
    router.push({
      pathname: '/report',
      params: {
        category: outcome.result.categories[0] ?? 'other',
        ...(hosts.length ? { hosts: hosts.join(',') } : {}),
      },
    });
  };

  return (
    <Screen title={t('title')} lead={t('lead')}>
      <Panel>
        <Field
          label={t('inputLabel')}
          placeholder={t('inputPlaceholder')}
          value={text}
          onChangeText={(v) => {
            setText(v.slice(0, MAX));
            if (outcome) setOutcome(null);
            if (v.length > 0) void loadEngine();
          }}
          multiline
          rows={5}
          maxLength={MAX}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            variant="primary"
            size="lg"
            icon="shield"
            busy={busy === 'phone'}
            disabled={!text.trim()}
            onPress={() => void checkOnPhone()}
          >
            {busy === 'phone' ? t('checking') : t('check')}
          </Button>
          {!text ? (
            <Button size="lg" icon="paste" onPress={() => void paste()}>
              {m('paste')}
            </Button>
          ) : outcome ? (
            <Button size="lg" variant="quiet" onPress={clear}>
              {t('clear')}
            </Button>
          ) : null}
        </View>
        <Text variant="small" tone="secondary">
          {m('private')}
        </Text>
      </Panel>

      {error ? <Notice tone="danger" title={error} live /> : null}

      {outcome ? (
        <>
          <ShieldResultView outcome={outcome} />
          <View style={{ gap: 10 }}>
            {outcome.result.level !== 'low' ? (
              <Button icon="flag" block onPress={report}>
                {t('reportThis')}
              </Button>
            ) : null}
            {outcome.where === 'phone' ? (
              <View style={{ gap: 6 }}>
                <Button
                  icon="web"
                  block
                  busy={busy === 'online'}
                  disabled={!online}
                  onPress={() => void checkOnline()}
                >
                  {m('secondOpinion')}
                </Button>
                <Text variant="small" tone="secondary">
                  {online ? m('secondOpinionHint') : m('offlineSecondOpinion')}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
