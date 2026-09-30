import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { useSettings } from '../../src/settings';
import { font, useTheme } from '../../src/theme';
import { Icon, type IconName } from '../../src/ui';

/**
 * Five places, always at the bottom: Today, Shield, Ask, Help and More. The chosen one is
 * marked in signal yellow, like the active line on a transit map; Help is always in the calm
 * support blue so it can be found in a hurry.
 */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <View
        style={{
          width: 24,
          height: 3,
          borderRadius: 2,
          backgroundColor: focused ? theme.colors.signal : 'transparent',
        }}
      />
      <Icon name={name} size={24} weight={focused ? 'fill' : 'regular'} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const nav = useTranslations('nav');
  const shell = useTranslations('shell');
  const { settings } = useSettings();

  if (!settings.welcomed) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.raised,
          borderTopColor: theme.colors.borderSubtle,
          borderTopWidth: 1,
          minHeight: 64,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: { ...font(theme, 'medium'), fontSize: 12 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: nav('today'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="today" focused={focused} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="shield"
        options={{
          title: nav('shield'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="shield" focused={focused} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: nav('ask'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="ask" focused={focused} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: shell('helpShort'),
          tabBarActiveTintColor: theme.colors.support,
          tabBarInactiveTintColor: theme.colors.support,
          tabBarAccessibilityLabel: shell('help'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="support" focused={focused} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: shell('more'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="more" focused={focused} color={String(color)} />
          ),
        }}
      />
    </Tabs>
  );
}
