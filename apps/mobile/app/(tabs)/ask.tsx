/**
 * Ask: talk a question, a worry or a decision through. Replies stream in as they're written.
 * Safety comes first on the server — a crisis check before any AI call, with the support card
 * in the person's language — and, if the phone is offline, the same check runs here.
 */
import { useChat } from '@ai-sdk/react';
import type { CrisisResponsePlan } from '@waypoint/core';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { ApiError, api } from '../../src/api';
import { authClient } from '../../src/auth';
import { confirm } from '../../src/confirm';
import {
  type AskMessage,
  type AskMode,
  askTransport,
  echoesCrisis,
  isToolName,
  isToolPart,
  loadConversation,
  MAX_MESSAGE,
  type ToolPartLike,
  uuid,
} from '../../src/features/ask';
import { CrisisCard } from '../../src/features/CrisisCard';
import { Markdown } from '../../src/features/Markdown';
import { deviceTimeZone, useAppLocale } from '../../src/i18n';
import { openLink, openPath } from '../../src/links';
import { useCountry } from '../../src/place';
import { useOnline } from '../../src/remote';
import { ensureSession } from '../../src/session';
import { TOUCH, useTheme } from '../../src/theme';
import { Button, Icon, Notice, Text, textStyle, useToast } from '../../src/ui';

interface ChatState {
  id: string;
  initial: AskMessage[];
}

export default function AskScreen() {
  const params = useLocalSearchParams<{ c?: string }>();
  const [chat, setChat] = useState<ChatState>(() => ({ id: uuid(), initial: [] }));
  const [loadError, setLoadError] = useState(false);

  // Opening a conversation from the list (…/ask?c=<id>).
  useEffect(() => {
    const id = params.c;
    if (!id || id === chat.id) return;
    const controller = new AbortController();
    setLoadError(false);
    loadConversation(id, controller.signal)
      .then((c) => setChat({ id: c.id, initial: c.messages }))
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [params.c, chat.id]);

  return (
    <Chat
      key={chat.id}
      chat={chat}
      loadError={loadError}
      onNew={() => setChat({ id: uuid(), initial: [] })}
    />
  );
}

function Chat({
  chat,
  loadError,
  onNew,
}: {
  chat: ChatState;
  loadError: boolean;
  onNew: () => void;
}) {
  const t = useTranslations('ask');
  const m = useTranslations('mobile.ask');
  const consentText = useTranslations('consents');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const { locale } = useAppLocale();
  const { country } = useCountry();
  const session = authClient.useSession();
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [offlineCrisis, setOfflineCrisis] = useState<CrisisResponsePlan | null>(null);
  const offlineChecks = useRef(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [aiTurnedOn, setAiTurnedOn] = useState(false);
  const scroller = useRef<ScrollView>(null);
  // A support card appeared: keep its top in view instead of following the text below it.
  const heldAtCrisis = useRef(false);
  const shownCrisis = useRef(new Set<string>());
  const showCrisisAt = (key: string, y: number) => {
    if (shownCrisis.current.has(key)) return;
    shownCrisis.current.add(key);
    heldAtCrisis.current = true;
    scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };
  const transport = useMemo(askTransport, []);

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    regenerate,
    addToolApprovalResponse,
  } = useChat<AskMessage>({
    id: chat.id,
    messages: chat.initial,
    generateId: uuid,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const busy = status === 'submitted' || status === 'streaming' || starting;

  /** With no connection, the crisis check still runs on the phone. */
  const checkOffline = async (text: string) => {
    offlineChecks.current += 1;
    const { assessCrisis, planCrisisResponse } = await import('@waypoint/core/crisis');
    const assessment = assessCrisis(text);
    setOfflineCrisis(
      assessment.tier > 0 ? planCrisisResponse(assessment, { country, locale }) : null,
    );
  };

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, MAX_MESSAGE);
    if (!text || busy) return;
    if (error) clearError();
    setNotice(null);
    setOfflineCrisis(null);
    heldAtCrisis.current = false;
    setStarting(true);
    try {
      await ensureSession({ locale, country, timeZone: deviceTimeZone() });
    } catch (err) {
      setStarting(false);
      if (err instanceof ApiError && err.offline) {
        setNotice(m('offline'));
        await checkOffline(text);
      } else setNotice(errors('generic'));
      return;
    }
    setStarting(false);
    setInput('');
    void sendMessage({ text });
  };

  // A failed request (offline, server down): run the crisis check on the phone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when an error appears
  useEffect(() => {
    if (!error) return;
    const last = [...messages].reverse().find((msg) => msg.role === 'user');
    const text = last?.parts.map((p) => (p.type === 'text' ? p.text : '')).join(' ') ?? '';
    if (text) void checkOffline(text);
  }, [error]);

  const turnOnAi = async () => {
    const ok = await confirm({
      title: consentText('ai_external'),
      message: consentText('ai_externalHint'),
      confirmLabel: m('turnOnAi'),
      cancelLabel: common('cancel'),
    });
    if (!ok) return;
    try {
      await api('/me/consents', { method: 'PUT', json: { ai_external: true } });
      setAiTurnedOn(true);
      toast(m('aiOn'));
    } catch {
      toast(errors('generic'), 'danger');
    }
  };

  const modeNote = (data: AskMode) => {
    if (data.mode === 'safe') return t('modeSafe');
    if (data.mode !== 'guided') return null;
    if (data.reason === 'no-consent') return aiTurnedOn ? m('aiOnNext') : t('modeGuidedNoConsent');
    if (['budget', 'daily-limit', 'monthly-budget'].includes(data.reason ?? ''))
      return t('modeGuidedBudget');
    return t('modeGuided');
  };

  const renderTool = (part: ToolPartLike) => {
    const name = part.type.slice(5);
    const label = isToolName(name) ? t(`tools.${name}`) : t('toolRunning');
    const line = (text: string, extra?: ReactNode) => (
      <View
        key={part.toolCallId}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
      >
        <Icon name="check" size={16} color={theme.colors.textSecondary} />
        <Text variant="small" tone="secondary">
          {text}
        </Text>
        {extra}
      </View>
    );
    if (part.state === 'approval-requested' && part.approval) {
      const approvalId = part.approval.id;
      const input = part.input ?? {};
      const summary =
        typeof input.title === 'string'
          ? input.title
          : typeof input.content === 'string'
            ? input.content
            : undefined;
      return (
        <View
          key={part.toolCallId}
          style={{
            gap: 10,
            padding: 14,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.borderStrong,
            backgroundColor: theme.colors.raised,
          }}
        >
          <Text weight="semibold">{t('approveTitle', { action: label })}</Text>
          {summary ? <Text tone="secondary">{`“${summary}”`}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              variant="primary"
              size="sm"
              icon="check"
              onPress={() => addToolApprovalResponse({ id: approvalId, approved: true })}
            >
              {t('approve')}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onPress={() =>
                addToolApprovalResponse({
                  id: approvalId,
                  approved: false,
                  reason: 'declined by person',
                })
              }
            >
              {t('decline')}
            </Button>
          </View>
        </View>
      );
    }
    if (part.state === 'approval-responded')
      return line(part.approval?.approved ? t('approved') : t('declined'));
    if (part.state === 'output-denied') return line(t('declined'));
    if (part.state === 'output-error') return line(t('errorGeneric'));
    if (part.state === 'output-available') {
      const href = typeof part.output?.href === 'string' ? part.output.href : null;
      const saved =
        name === 'create_goal'
          ? t('savedGoal')
          : name === 'draft_plan'
            ? t('savedPlan')
            : name === 'save_memory'
              ? t('savedMemory')
              : label;
      return line(
        saved,
        href ? (
          <Button size="sm" variant="quiet" icon="external" onPress={() => void openPath(href)}>
            {t('openIt')}
          </Button>
        ) : null,
      );
    }
    return line(`${label}…`);
  };

  const body = textStyle(theme, 'body');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      behavior="padding"
    >
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 8,
          gap: 4,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderSubtle,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="h3" style={{ flex: 1 }}>
            {t('title')}
          </Text>
          {session.data?.user ? (
            <Button
              size="sm"
              variant="quiet"
              icon="history"
              onPress={() => router.push('/conversations')}
            >
              {t('history')}
            </Button>
          ) : null}
          {messages.length ? (
            <Button size="sm" icon="add" onPress={onNew} accessibilityLabel={t('newChat')}>
              {m('new')}
            </Button>
          ) : null}
        </View>
        <Text variant="small" tone="secondary">
          {t('disclosure')}
        </Text>
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => {
          if (!heldAtCrisis.current) scroller.current?.scrollToEnd({ animated: true });
        }}
        accessibilityLiveRegion="polite"
      >
        {loadError ? <Notice tone="caution" title={errors('generic')} /> : null}

        {messages.length === 0 && !offlineCrisis ? (
          <View style={{ gap: 12 }}>
            <Text variant="lead" tone="secondary">
              {t('lead')}
            </Text>
            <Text weight="semibold">{t('starters')}</Text>
            {(['starter1', 'starter2', 'starter3', 'starter4'] as const).map((k) => (
              <Button
                key={k}
                block
                onPress={() => void send(t(k))}
                style={{ justifyContent: 'flex-start' }}
              >
                {t(k)}
              </Button>
            ))}
          </View>
        ) : null}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <View
              key={msg.id}
              accessibilityLabel={t('you')}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '88%',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: theme.radius.md,
                borderBottomEndRadius: theme.radius.xs,
                backgroundColor: theme.modules.ask.tint,
              }}
            >
              {msg.parts.map((p, i) => (p.type === 'text' ? <Text key={i}>{p.text}</Text> : null))}
            </View>
          ) : (
            <View
              key={msg.id}
              style={{ gap: 12 }}
              accessibilityLabel={t('waypoint')}
              onLayout={(e) => {
                if (msg.parts.some((p) => p.type === 'data-crisis'))
                  showCrisisAt(msg.id, e.nativeEvent.layout.y);
              }}
            >
              {msg.parts.map((part, i) => {
                const key = `${msg.id}-${i}`;
                if (part.type === 'text') {
                  if (!dismissed.has(msg.id) && echoesCrisis(msg, part.text)) return null;
                  return <Markdown key={key} text={part.text} />;
                }
                if (part.type === 'data-crisis') {
                  if (dismissed.has(msg.id)) return null;
                  return (
                    <CrisisCard
                      key={key}
                      plan={part.data}
                      onStay={() => setDismissed((s) => new Set(s).add(msg.id))}
                    />
                  );
                }
                if (part.type === 'data-mode') {
                  const note = modeNote(part.data);
                  if (!note) return null;
                  const offerAi = part.data.reason === 'no-consent' && !aiTurnedOn;
                  return (
                    <View key={key} style={{ gap: 8 }}>
                      <Text variant="small" tone="secondary">
                        {note}
                      </Text>
                      {offerAi ? (
                        <Button size="sm" icon="ask" onPress={() => void turnOnAi()}>
                          {m('turnOnAi')}
                        </Button>
                      ) : null}
                    </View>
                  );
                }
                if (part.type === 'source-url') {
                  return (
                    <Button
                      key={key}
                      size="sm"
                      variant="quiet"
                      icon="external"
                      onPress={() => void openLink(part.url)}
                    >
                      {part.title ?? part.url}
                    </Button>
                  );
                }
                if (isToolPart(part)) return renderTool(part);
                return null;
              })}
            </View>
          ),
        )}

        {status === 'submitted' ? (
          <Text variant="small" tone="secondary">{`${t('thinking')}…`}</Text>
        ) : null}

        {offlineCrisis ? (
          <View
            onLayout={(e) =>
              showCrisisAt(`offline-${offlineChecks.current}`, e.nativeEvent.layout.y)
            }
          >
            <CrisisCard plan={offlineCrisis} onStay={() => setOfflineCrisis(null)} />
          </View>
        ) : null}
        {notice ? <Notice tone="caution" title={notice} live /> : null}
        {error ? (
          <Notice
            tone="danger"
            title={online ? t('errorGeneric') : m('offline')}
            live
            actions={
              <Button size="sm" icon="retry" onPress={() => void regenerate()}>
                {common('retry')}
              </Button>
            }
          />
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.raised,
        }}
      >
        <TextInput
          value={input}
          onChangeText={(v) => setInput(v.slice(0, MAX_MESSAGE))}
          placeholder={t('inputPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('inputLabel')}
          multiline
          maxLength={MAX_MESSAGE}
          style={[
            body,
            {
              flex: 1,
              minHeight: TOUCH,
              maxHeight: 140,
              paddingHorizontal: 12,
              paddingTop: 11,
              paddingBottom: 11,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.canvas,
              color: theme.colors.text,
            },
          ]}
        />
        {status === 'streaming' || status === 'submitted' ? (
          <Button icon="stop" onPress={() => void stop()} accessibilityLabel={t('stop')}>
            {t('stop')}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="send"
            busy={starting}
            disabled={!input.trim()}
            onPress={() => void send(input)}
            accessibilityLabel={t('send')}
          >
            {t('send')}
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
