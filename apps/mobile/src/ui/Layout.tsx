/**
 * Screens and surfaces: the concrete-grey canvas, white raised panels with a hairline border,
 * and one column of content that stays readable on tablets.
 */
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

const MAX_WIDTH = 640;

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  lead?: string;
  /** A line above the title (a date, a step count). */
  above?: string;
  /** Tab screens draw under the status bar; screens with a navigation header don't. */
  underStatusBar?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Content fixed below the scrolling area (a message composer). */
  footer?: ReactNode;
  scroll?: boolean;
}

export function Screen({
  children,
  title,
  lead,
  above,
  underStatusBar = true,
  refreshing,
  onRefresh,
  footer,
  scroll = true,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const head =
    title || lead || above ? (
      <View style={{ gap: 6, marginBottom: 4 }}>
        {above ? (
          <Text variant="small" tone="secondary">
            {above}
          </Text>
        ) : null}
        {title ? <Text variant="h2">{title}</Text> : null}
        {lead ? (
          <Text variant="lead" tone="secondary">
            {lead}
          </Text>
        ) : null}
      </View>
    ) : null;

  const column = (
    <View style={{ width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: 20 }}>
      {head}
      {children}
    </View>
  );

  const padding = {
    paddingTop: (underStatusBar ? insets.top : 0) + 20,
    paddingBottom: footer ? 16 : 32,
    paddingHorizontal: 16,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={padding}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={theme.colors.textSecondary}
                colors={[theme.colors.text]}
              />
            ) : undefined
          }
        >
          {column}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding]}>{column}</View>
      )}
      {footer}
    </View>
  );
}

/** A raised panel. `flush` panels hold rows edge to edge, separated by hairlines. */
export function Panel({
  title,
  description,
  action,
  flush,
  children,
  style,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  flush?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.raised,
          borderColor: theme.colors.borderSubtle,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {title || description ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: flush ? 12 : 4,
            borderBottomWidth: flush && children ? 1 : 0,
            borderBottomColor: theme.colors.borderSubtle,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            {title ? (
              <Text variant="lead" weight="semibold" accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {description ? (
              <Text variant="small" tone="secondary">
                {description}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {flush ? (
        children
      ) : (
        <View style={{ padding: 16, paddingTop: title ? 12 : 16, gap: 12 }}>{children}</View>
      )}
    </View>
  );
}

/** One row in a flush panel: a mark, words, and a chevron when it goes somewhere. */
export function Row({
  leading,
  title,
  description,
  trailing,
  onPress,
  first,
  accessibilityLabel,
  accessibilityHint,
  selected,
}: {
  leading?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  /** No hairline above the first row. */
  first?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
}) {
  const theme = useTheme();
  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.borderSubtle,
        backgroundColor: pressed ? theme.colors.sunken : 'transparent',
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="medium">{title}</Text>
        {description ? (
          <Text variant="small" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (selected ? (
          <Icon name="check" size={20} color={theme.colors.text} />
        ) : onPress ? (
          <Icon name="chevronRight" size={18} color={theme.colors.textMuted} />
        ) : null)}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** A small heading between groups of panels. */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="h4" style={{ marginTop: 8 }}>
      {children}
    </Text>
  );
}
