/**
 * The small marks of the wayfinding system: module pictograms in their line colour, notices,
 * the Scam Shield risk meter and routes drawn as transit lines.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { type Theme, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ModuleKey =
  | 'today'
  | 'path'
  | 'shield'
  | 'circles'
  | 'ask'
  | 'signals'
  | 'money'
  | 'mind'
  | 'health'
  | 'civic'
  | 'surroundings'
  | 'goals'
  | 'org'
  | 'support';

const MARK_PX = { sm: 28, md: 36, lg: 48 } as const;
const MARK_ICON = { sm: 16, md: 20, lg: 26 } as const;

function lineOf(theme: Theme, module: ModuleKey) {
  if (module === 'support') return { line: theme.colors.support, tint: theme.colors.supportTint };
  return theme.modules[module];
}

/** A module's pictogram in its line colour, the way transit maps mark a line. */
export function ModuleMark({
  module,
  size = 'md',
  tone = 'tint',
}: {
  module: ModuleKey;
  size?: 'sm' | 'md' | 'lg';
  /** `sign`: on the slate sign (signal yellow on translucent white). */
  tone?: 'tint' | 'sign';
}) {
  const theme = useTheme();
  const { line, tint } = lineOf(theme, module);
  const onSign = tone === 'sign';
  return (
    <View
      style={{
        width: MARK_PX[size],
        height: MARK_PX[size],
        borderRadius: theme.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onSign ? `${theme.colors.signText.slice(0, 7)}1f` : tint,
      }}
    >
      <Icon
        name={module as IconName}
        size={MARK_ICON[size]}
        weight="fill"
        color={onSign ? theme.colors.signal : line}
      />
    </View>
  );
}

export type NoticeTone = 'info' | 'caution' | 'danger' | 'safe' | 'support' | 'neutral';

const NOTICE_ICON: Record<NoticeTone, IconName> = {
  info: 'info',
  caution: 'caution',
  danger: 'danger',
  safe: 'safe',
  support: 'support',
  neutral: 'info',
};

function noticeColors(theme: Theme, tone: NoticeTone) {
  const c = theme.colors;
  switch (tone) {
    case 'caution':
      return { tone: c.caution, tint: c.cautionTint };
    case 'danger':
      return { tone: c.danger, tint: c.dangerTint };
    case 'safe':
      return { tone: c.safe, tint: c.safeTint };
    case 'support':
      return { tone: c.support, tint: c.supportTint };
    case 'neutral':
      return { tone: c.textSecondary, tint: c.sunken };
    default:
      return { tone: c.info, tint: c.infoTint };
  }
}

/** A callout that explains a situation and offers the next action. */
export function Notice({
  tone = 'info',
  title,
  children,
  actions,
  icon,
  live,
}: {
  tone?: NoticeTone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  /** Announce it when it appears (errors, results). */
  live?: boolean;
}) {
  const theme = useTheme();
  const { tone: color, tint } = noticeColors(theme, tone);
  return (
    <View
      accessibilityLiveRegion={live ? 'polite' : undefined}
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: `${color.slice(0, 7)}47`,
        borderStartWidth: 4,
        borderStartColor: color,
        backgroundColor: tint,
      }}
    >
      <View style={{ paddingTop: 2 }}>
        <Icon name={icon ?? NOTICE_ICON[tone]} size={20} weight="fill" color={color} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text weight="semibold">{title}</Text>
        {typeof children === 'string' ? <Text tone="secondary">{children}</Text> : children}
        {actions ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {actions}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export type RiskLevel = 'low' | 'unclear' | 'high' | 'very-high';
const LEVELS: RiskLevel[] = ['low', 'unclear', 'high', 'very-high'];

/** Scam Shield's verdict: four steps with words, never colour alone. */
export function RiskMeter({
  level,
  verdict,
  scale,
}: {
  level: RiskLevel;
  verdict: string;
  scale: [string, string, string, string];
}) {
  const theme = useTheme();
  const index = LEVELS.indexOf(level);
  const color =
    level === 'low'
      ? theme.colors.safe
      : level === 'unclear'
        ? theme.colors.caution
        : theme.colors.danger;
  const icon: IconName = level === 'low' ? 'safe' : level === 'unclear' ? 'caution' : 'danger';
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
      >
        <View style={{ paddingTop: 3 }}>
          <Icon name={icon} size={26} weight="fill" color={color} />
        </View>
        <Text variant="h4" style={{ color, flex: 1 }}>
          {verdict}
        </Text>
      </View>
      <View
        style={{ flexDirection: 'row', gap: 4 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {LEVELS.map((l, i) => (
          <View
            key={l}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 2,
              backgroundColor: i <= index ? color : theme.colors.sunken,
              borderWidth: i <= index ? 0 : 1,
              borderColor: theme.colors.borderSubtle,
            }}
          />
        ))}
      </View>
      <View
        style={{ flexDirection: 'row', gap: 4 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {scale.map((s, i) => (
          <Text
            key={s}
            variant="meta"
            tone={i === index ? 'default' : 'muted'}
            weight={i === index ? 'medium' : 'regular'}
            style={{ flex: 1 }}
          >
            {s}
          </Text>
        ))}
      </View>
    </View>
  );
}

export type StationState = 'done' | 'current' | 'upcoming';

export interface Station {
  id: string;
  label: string;
  meta?: string;
  state: StationState;
}

/**
 * A sequence drawn as a transit line: solid track behind you, dashed ahead, and the station
 * you're at marked in signal yellow. Only for real sequences, never decoration.
 */
export function RouteLine({
  stations,
  module = 'path',
  stateLabels,
}: {
  stations: Station[];
  module?: ModuleKey;
  stateLabels: Record<StationState, string>;
}) {
  const theme = useTheme();
  const { line } = lineOf(theme, module);
  return (
    <View accessibilityRole="list">
      {stations.map((s, i) => {
        const last = i === stations.length - 1;
        const ahead = s.state !== 'done';
        return (
          <View
            key={s.id}
            style={{ flexDirection: 'row', gap: 12 }}
            accessible
            accessibilityLabel={`${stateLabels[s.state]}: ${s.label}${s.meta ? `, ${s.meta}` : ''}`}
          >
            <View style={{ width: 32, alignItems: 'center' }}>
              <View
                style={{
                  marginTop: s.state === 'current' ? 1 : 3,
                  width: s.state === 'current' ? 20 : 16,
                  height: s.state === 'current' ? 20 : 16,
                  borderRadius: 10,
                  borderWidth: 4,
                  borderColor: s.state === 'current' ? theme.colors.text : line,
                  backgroundColor:
                    s.state === 'done'
                      ? line
                      : s.state === 'current'
                        ? theme.colors.signal
                        : theme.colors.raised,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
              />
              {!last ? (
                <View style={{ flex: 1, width: 4, marginTop: 2, gap: 6, overflow: 'hidden' }}>
                  {ahead ? (
                    // Track ahead is dashed, like a line under construction.
                    Array.from({ length: 12 }, (_, k) => (
                      <View
                        key={k}
                        style={{ height: 6, borderRadius: 2, backgroundColor: line, opacity: 0.55 }}
                      />
                    ))
                  ) : (
                    <View style={{ flex: 1, borderRadius: 2, backgroundColor: line }} />
                  )}
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 20, gap: 2 }}>
              <Text
                weight={s.state === 'current' ? 'semibold' : 'medium'}
                tone={s.state === 'done' ? 'secondary' : 'default'}
              >
                {s.label}
              </Text>
              {s.meta ? (
                <Text variant="meta" tone="muted">
                  {s.meta}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
