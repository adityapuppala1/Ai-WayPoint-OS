/**
 * What Scam Shield found: the verdict on a four-step meter, the warning signs in plain words,
 * the links, what to do next and where to report — the same result the website shows.
 */
import type { ShieldResult } from '@waypoint/core';
import { ltr } from '@waypoint/core/text';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { openLink, telHref } from '../links';
import { useTheme } from '../theme';
import { Button, Notice, Panel, RiskMeter, Text } from '../ui';

export interface ShieldOutcome {
  result: ShieldResult;
  /** Where the check ran: on the phone, or on Waypoint's server (with its extra checks). */
  where: 'phone' | 'online';
  ai?: { used: boolean; reason: string };
  seenBefore?: number | null;
}

function Item({ title, body, first }: { title: string; body?: string; first?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: 2,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.borderSubtle,
      }}
    >
      <Text weight="semibold">{title}</Text>
      {body ? <Text tone="secondary">{body}</Text> : null}
    </View>
  );
}

export function ShieldResultView({ outcome }: { outcome: ShieldOutcome }) {
  const t = useTranslations('shield');
  const m = useTranslations('mobile.shield');
  const levels = useTranslations('riskLevels');
  const theme = useTheme();
  const { result } = outcome;
  const verdict = {
    low: t('verdictLow'),
    unclear: t('verdictUnclear'),
    high: t('verdictHigh'),
    'very-high': t('verdictVeryHigh'),
  }[result.level];
  const aiLine = outcome.ai?.used
    ? result.engine.ai?.agreed
      ? t('aiAgreed')
      : t('aiRaised')
    : outcome.ai?.reason === 'skipped-certain'
      ? t('aiSkipped')
      : null;

  return (
    <View style={{ gap: 16 }}>
      <Text variant="h3">{t('resultTitle')}</Text>
      <RiskMeter
        level={result.level}
        verdict={verdict}
        scale={[levels('low'), levels('unclear'), levels('high'), levels('very-high')]}
      />
      {result.level === 'low' ? <Text tone="secondary">{t('lowNote')}</Text> : null}
      {outcome.seenBefore ? (
        <Notice tone="caution" title={t('seenBefore', { count: outcome.seenBefore })} />
      ) : null}

      {result.signals.length ? (
        <Panel title={t('signsTitle')} flush>
          {result.signals.map((s, i) => (
            <Item key={s.id} title={s.title} body={s.explanation} first={i === 0} />
          ))}
        </Panel>
      ) : (
        <Text tone="secondary">{t('noSigns')}</Text>
      )}

      {result.urls.length ? (
        <Panel title={t('linksTitle')} flush>
          {result.urls.map((u, i) => (
            <View
              key={u.url}
              style={{
                gap: 2,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.colors.borderSubtle,
              }}
            >
              <Text weight="semibold">{ltr(u.host)}</Text>
              {u.lookalikeOf ? (
                <Text tone="danger" weight="medium">
                  {t('linkLookalike', { brand: u.lookalikeOf })}
                </Text>
              ) : null}
            </View>
          ))}
        </Panel>
      ) : null}

      <Panel title={t('whatToDo')}>
        {result.advice.map((a, i) => (
          <View key={a} style={{ flexDirection: 'row', gap: 10 }}>
            <Text weight="semibold" tabular>
              {`${i + 1}.`}
            </Text>
            <Text style={{ flex: 1 }}>{a}</Text>
          </View>
        ))}
      </Panel>

      {result.report.length ? (
        <Panel title={t('reportTitle')} flush>
          {result.report.map((c, i) => (
            <View
              key={`${c.country}-${c.name}`}
              style={{
                gap: 6,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.colors.borderSubtle,
              }}
            >
              <Text weight="semibold">{c.name}</Text>
              {c.timeCritical ? (
                <Text variant="small" weight="medium" tone="caution">
                  {t('reportTimeCritical')}
                </Text>
              ) : null}
              <Text tone="secondary">{c.what}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {c.phone ? (
                  <Button
                    size="sm"
                    icon="phone"
                    onPress={() => void openLink(telHref(c.phone as string))}
                  >
                    {ltr(c.phone)}
                  </Button>
                ) : null}
                {c.url ? (
                  <Button
                    size="sm"
                    variant="quiet"
                    icon="external"
                    onPress={() => void openLink(c.url as string)}
                  >
                    {c.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </Button>
                ) : null}
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      <Text variant="meta" tone="muted">
        {[
          outcome.where === 'phone' ? m('checkedOnPhone') : m('checkedOnline'),
          aiLine,
          t('engine', { version: result.engine.rules }),
        ]
          .filter(Boolean)
          .join(' ')}
      </Text>
    </View>
  );
}
