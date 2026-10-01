/**
 * Today: one next step on the sign, this week's route, and only what changed for this person.
 * Calm by design — a few items, no feed. Before someone has started, the sign invites them to
 * tell Waypoint where they are, and the tools that need no account are right there.
 */
import type { SignalView, TodayView } from '@waypoint/api/client';
import { supportDirectory } from '@waypoint/content';
import { ltr } from '@waypoint/core/text';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { api } from '../../src/api';
import { authClient } from '../../src/auth';
import { notNowCookie, notNowStorageKey, setAside } from '../../src/features/not-now';
import { todaySign } from '../../src/features/today-sign';
import { deviceTimeZone, useAppLocale } from '../../src/i18n';
import { openLink, openPath, telHref } from '../../src/links';
import { useCountry } from '../../src/place';
import { useRemote } from '../../src/remote';
import { readJson, writeJson } from '../../src/storage';
import { useTheme } from '../../src/theme';
import {
  Button,
  type ModuleKey,
  ModuleMark,
  Notice,
  Panel,
  RouteLine,
  Row,
  Screen,
  Sign,
  type Station,
  Text,
  useToast,
} from '../../src/ui';

type StepKind = 'learn' | 'build' | 'connect' | 'apply' | 'reflect';
type ReasonKey =
  | 'country'
  | 'region'
  | 'global'
  | 'sector'
  | 'skill'
  | 'life-stage'
  | 'situation'
  | 'role';

function partOfDay(timeZone: string): 'morning' | 'afternoon' | 'evening' {
  let hour = new Date().getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(
        new Date(),
      ),
    );
  } catch {
    // Unknown zone: the phone's own clock is close enough.
  }
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

function Signal({ s, first }: { s: SignalView; first: boolean }) {
  const t = useTranslations('today');
  const reasons = useTranslations('relevanceReasons');
  const common = useTranslations('common');
  const format = useFormatter();
  const theme = useTheme();
  const [why, setWhy] = useState(false);
  return (
    <View
      style={{
        gap: 6,
        padding: 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.borderSubtle,
      }}
    >
      <Text weight="semibold">{s.title}</Text>
      {s.isDemo ? (
        <Text variant="meta" tone="muted">
          {common('demoData')}
        </Text>
      ) : null}
      <Text tone="secondary">{s.summary}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12 }}>
        <Button
          size="sm"
          variant="quiet"
          icon="external"
          onPress={() => void openLink(s.sourceUrl)}
        >
          {t('source', { name: s.sourceName })}
        </Button>
        <Text variant="small" tone="muted">
          {format.dateTime(new Date(s.publishedAt), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>
      {s.reasons.length ? (
        <View style={{ gap: 4 }}>
          <Button
            size="sm"
            variant="quiet"
            icon={why ? 'chevronDown' : 'chevronRight'}
            onPress={() => setWhy((w) => !w)}
          >
            {t('whySeeing')}
          </Button>
          {why
            ? s.reasons.map((r) => (
                <Text key={r} variant="small" tone="secondary" style={{ paddingStart: 12 }}>
                  {`• ${reasons(r as ReasonKey)}`}
                </Text>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

export default function TodayScreen() {
  const t = useTranslations('today');
  const m = useTranslations('mobile.today');
  const kinds = useTranslations('stepKinds');
  const a11y = useTranslations('a11y');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const money = useTranslations('money');
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const theme = useTheme();
  const { locale } = useAppLocale();
  const { country } = useCountry();
  const session = authClient.useSession();
  const user = session.data?.user;
  const userId = user?.id;
  // "Not now": the steps set aside today, kept on this phone and sent with Today
  // (src/features/not-now.ts). Today waits until they have been read, so a step set aside
  // never comes back for a moment. The web build has the browser's cookie instead.
  const native = Platform.OS !== 'web';
  const setAsideToday = useRef<string | null>(null);
  const [setAsideReadFor, setSetAsideReadFor] = useState<string | null>(null);
  useEffect(() => {
    if (!native || !userId) return;
    let live = true;
    void readJson<string>(notNowStorageKey(userId)).then((value) => {
      if (!live) return;
      setAsideToday.current = value;
      setSetAsideReadFor(userId);
    });
    return () => {
      live = false;
    };
  }, [native, userId]);
  const today = useRemote<TodayView>(
    userId && (!native || setAsideReadFor === userId) ? `today:${userId}:${locale}` : null,
    (signal) => {
      const cookie = native ? notNowCookie(setAsideToday.current) : undefined;
      return api<TodayView>('/today', { signal, headers: cookie ? { cookie } : undefined });
    },
  );
  const [marking, setMarking] = useState(false);
  const [deferring, setDeferring] = useState(false);

  const zone = deviceTimeZone();
  const greeting = t(partOfDay(zone));
  const view = today.data;
  const heading = view?.name ? t('greetingName', { greeting, name: view.name }) : greeting;
  const dateLine = format.dateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const emergency = view?.emergencyNumber ?? supportDirectory(country).emergency?.general ?? null;

  const go = (href: string) => void openPath(href);

  const markDone = async () => {
    const step = view?.nextStep;
    if (!step?.planId || !step.stepId) return;
    setMarking(true);
    try {
      await api(`/path/plans/${step.planId}/steps/${step.stepId}`, {
        method: 'PATCH',
        json: { status: 'done' },
      });
      toast(t('doneToast'));
      today.reload({ quiet: true });
    } catch {
      toast(errors('generic'), 'danger');
    } finally {
      setMarking(false);
    }
  };

  // Set aside for the rest of the day where the person is; Today then offers the next step.
  const notNow = async () => {
    const step = view?.nextStep;
    if (!step || !userId) return;
    setDeferring(true);
    try {
      if (native) {
        const next = setAside(setAsideToday.current, step.key, new Date(), zone);
        setAsideToday.current = next;
        await writeJson(notNowStorageKey(userId), next);
      } else {
        await api('/today/not-now', { json: { key: step.key } });
      }
      today.reload({ quiet: true });
    } catch {
      toast(errors('generic'), 'danger');
    } finally {
      setDeferring(false);
    }
  };

  const dismissNudge = async (id: string, action: 'acted' | 'dismissed') => {
    await api(`/nudges/${id}`, { json: { action } }).catch(() => undefined);
    today.reload({ quiet: true });
  };

  const tools: Array<{ module: ModuleKey; title: string; hint: string; href: string }> = [
    { module: 'shield', title: t('toolShield'), hint: t('toolShieldHint'), href: '/shield' },
    { module: 'support', title: t('toolHelp'), hint: t('toolHelpHint'), href: '/support' },
    { module: 'ask', title: t('toolAsk'), hint: t('toolAskHint'), href: '/ask' },
    ...(user
      ? ([
          {
            module: 'money',
            title: view?.money ? money(`stress.${view.money.stress}.title`) : t('toolMoney'),
            hint: view?.money
              ? view.money.monthsOfRunway === null
                ? money('runwayNone')
                : view.money.monthsOfRunway < 1
                  ? money('runwayLessThanMonth')
                  : money('runwayMonths', { months: view.money.monthsOfRunway })
              : t('toolMoneyHint'),
            href: '/money',
          },
          { module: 'mind', title: t('toolMind'), hint: t('toolMindHint'), href: '/mind' },
          {
            module: 'circles',
            title: t('toolCircles'),
            hint: t('toolCirclesHint'),
            href: '/circles',
          },
        ] as const)
      : []),
  ];

  const step = view?.nextStep;
  const sign = view ? todaySign(view) : null;
  const lang = sign?.lang ?? undefined;
  const stations: Station[] =
    view?.week.map((s) => ({
      id: s.id,
      label: s.title,
      meta: `${kinds(s.kind as StepKind)}, ${t('minutes', { count: s.minutes })}`,
      state:
        s.status === 'done' || s.status === 'skipped'
          ? 'done'
          : s.id === sign?.currentStepId
            ? 'current'
            : 'upcoming',
    })) ?? [];

  return (
    <Screen
      above={dateLine}
      title={heading}
      refreshing={today.refreshing}
      onRefresh={user ? () => today.reload() : undefined}
    >
      {user && !view ? (
        today.loading || (native && setAsideReadFor !== userId) ? (
          <View
            style={{
              height: 220,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.sign,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={common('loading')}
          >
            <ActivityIndicator color={theme.colors.signal} />
          </View>
        ) : null
      ) : !user || !step ? (
        <Sign
          eyebrow={t('eyebrow')}
          title={t('onboardTitle')}
          module="today"
          actions={
            <>
              <Button
                variant="primary"
                size="lg"
                icon="forward"
                onPress={() => router.push('/start')}
              >
                {common('start')}
              </Button>
              {!user ? (
                <Button variant="onSign" size="lg" onPress={() => router.push('/account')}>
                  {common('signIn')}
                </Button>
              ) : null}
            </>
          }
        >
          <Text tone="signMuted">{t('onboardDetail')}</Text>
        </Sign>
      ) : (
        <Sign
          eyebrow={t('eyebrow')}
          title={step.title}
          lang={lang}
          flipKey={step.key}
          module={step.module as ModuleKey}
          context={sign?.planContext ? t('planContext', sign.planContext) : undefined}
          details={[
            ...(step.minutes
              ? [{ label: t('time'), value: t('minutes', { count: step.minutes }) }]
              : []),
            ...(sign?.from ? [{ label: t('from'), value: sign.from, lang }] : []),
            ...(sign?.why ? [{ label: t('whySeeing'), value: sign.why }] : []),
          ]}
          actions={
            <>
              {step.kind === 'plan-step' ? (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    icon="check"
                    busy={marking}
                    onPress={() => void markDone()}
                  >
                    {t('markDone')}
                  </Button>
                  <Button variant="onSign" size="lg" icon="external" onPress={() => go(step.href)}>
                    {m('open')}
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="lg" icon="forward" onPress={() => go(step.href)}>
                  {t('startStep')}
                </Button>
              )}
              {step.canDefer ? (
                <Button variant="onSign" size="lg" busy={deferring} onPress={() => void notNow()}>
                  {common('notNow')}
                </Button>
              ) : null}
            </>
          }
        >
          {step.detail ? (
            <Text tone="signMuted" accessibilityLanguage={lang}>
              {step.detail}
            </Text>
          ) : null}
        </Sign>
      )}

      {today.error && !view ? (
        <Notice
          tone={today.error.offline ? 'neutral' : 'caution'}
          title={today.error.offline ? errors('offlineTitle') : errors('generic')}
          actions={
            <Button size="sm" icon="retry" onPress={() => today.reload()}>
              {common('retry')}
            </Button>
          }
        >
          {today.error.offline ? errors('offlineBody') : undefined}
        </Notice>
      ) : null}

      {sign?.notes.map((n) => {
        const support = n.href === '/support';
        return (
          <Notice
            key={n.id}
            tone={support || n.priority === 'critical' ? 'support' : 'info'}
            title={n.title}
            actions={
              <>
                {n.href ? (
                  <Button
                    size="sm"
                    variant={support ? 'support' : 'secondary'}
                    icon={support ? 'support' : 'forward'}
                    onPress={() => {
                      void dismissNudge(n.id, 'acted');
                      go(n.href as string);
                    }}
                  >
                    {support ? t('nudgeSupport') : t('nudgeOpen')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="quiet"
                  onPress={() => void dismissNudge(n.id, 'dismissed')}
                >
                  {t('nudgeDismiss')}
                </Button>
              </>
            }
          >
            {n.body ?? undefined}
          </Notice>
        );
      })}

      {view?.plan && stations.length ? (
        <Panel
          title={t('weekTitle')}
          description={t('progress', {
            done: view.week.filter((s) => s.status === 'done' || s.status === 'skipped').length,
            total: view.week.length,
          })}
        >
          <RouteLine
            stations={stations}
            module="path"
            stateLabels={{
              done: a11y('routeDone'),
              current: a11y('routeCurrent'),
              upcoming: a11y('routeUpcoming'),
            }}
          />
          <Button
            variant="quiet"
            icon="external"
            onPress={() => go(`/path/plans/${view.plan?.id}`)}
          >
            {t('openPlan')}
          </Button>
        </Panel>
      ) : null}

      {view?.checklist ? (
        <Panel title={t('checklistTitle')} flush>
          <Row
            first
            leading={<ModuleMark module="civic" size="sm" />}
            title={view.checklist.title}
            description={t('checklistProgress', {
              done: view.checklist.done,
              total: view.checklist.total,
            })}
            onPress={() => go(view.checklist?.href ?? '/civic')}
          />
        </Panel>
      ) : null}

      {view ? (
        <Panel title={t('changedTitle')} flush>
          {view.signals.length ? (
            view.signals.map((s, i) => <Signal key={s.id} s={s} first={i === 0} />)
          ) : (
            <View style={{ padding: 16 }}>
              <Text tone="secondary">{t('changedEmpty')}</Text>
            </View>
          )}
        </Panel>
      ) : null}

      <Panel title={t('toolsTitle')} flush>
        {tools.map((tool, i) => (
          <Row
            key={tool.href}
            first={i === 0}
            leading={<ModuleMark module={tool.module} size="sm" />}
            title={tool.title}
            description={tool.hint}
            onPress={() => go(tool.href)}
          />
        ))}
      </Panel>

      {emergency ? (
        <Button variant="quiet" icon="phone" onPress={() => void openLink(telHref(emergency))}>
          {m('emergency', { number: ltr(emergency) })}
        </Button>
      ) : null}
    </Screen>
  );
}
