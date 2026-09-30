/**
 * The Next Step sign — Waypoint's one bold element: a slate wayfinding panel with a signal
 * yellow edge, one message and one main action. At most one per screen. When the step
 * changes, the title flips like a departures board (the one orchestrated motion), or simply
 * appears when the phone asks for less motion.
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme';
import { type ModuleKey, ModuleMark } from './Marks';
import { Text } from './Text';

export interface SignDetail {
  label: string;
  value: string;
  /** The language the value is written in, when it is not the reader's. */
  lang?: string;
}

export function Sign({
  eyebrow,
  title,
  lang,
  flipKey,
  module = 'today',
  context,
  details,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  /** The language the title is written in, when it is not the reader's (for screen readers). */
  lang?: string;
  flipKey?: string;
  module?: ModuleKey;
  context?: string;
  details?: SignDetail[];
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const flip = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to the step changing
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      flip.setValue(0);
      Animated.timing(flip, {
        toValue: 1,
        duration: reduce ? 80 : theme.motion.flip,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [flipKey]);

  const rotateX = flip.interpolate({ inputRange: [0, 1], outputRange: ['-80deg', '0deg'] });
  const opacity = flip.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  const titleVariant = width >= 600 ? 'h1' : width >= 400 ? 'h2' : 'h3';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: theme.colors.sign,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: `${theme.colors.signText.slice(0, 7)}1a`,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {/* The signal edge: a yellow band on the leading side, like a directional sign. */}
      <View style={{ width: 6, backgroundColor: theme.colors.signal }} />
      <View style={{ flex: 1, padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <ModuleMark module={module} tone="sign" />
          <Text variant="small" weight="medium" tone="signMuted" style={{ flexShrink: 1 }}>
            {eyebrow}
          </Text>
          {context ? (
            <Text variant="small" tone="signMuted" tabular style={{ flexBasis: '100%' }}>
              {context}
            </Text>
          ) : null}
        </View>
        <Animated.View style={{ opacity, transform: [{ perspective: 640 }, { rotateX }] }}>
          <Text variant={titleVariant} tone="sign" accessibilityLanguage={lang}>
            {title}
          </Text>
        </Animated.View>
        {children ? <View style={{ gap: 8 }}>{children}</View> : null}
        {details?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
            {details.map((d) => (
              <View key={d.label} style={{ gap: 2 }}>
                <Text variant="small" tone="signMuted">
                  {d.label}
                </Text>
                <Text
                  variant="small"
                  weight="medium"
                  tone="sign"
                  tabular
                  accessibilityLanguage={d.lang}
                >
                  {d.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {actions ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
            {actions}
          </View>
        ) : null}
      </View>
    </View>
  );
}
