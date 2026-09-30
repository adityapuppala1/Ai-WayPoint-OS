/**
 * Short confirmations ("Report sent", "Done") that appear at the bottom for a few seconds and
 * are read out by screen readers. Never used for errors that need an action: those stay on
 * the screen as a Notice.
 */
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Tone = 'safe' | 'danger' | 'info';
interface Toast {
  title: string;
  tone: Tone;
  key: number;
}

const ToastContext = createContext<(title: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({
  children,
  bottomOffset = 72,
}: {
  children: ReactNode;
  bottomOffset?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (title: string, tone: Tone = 'safe') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ title, tone, key: Date.now() });
      AccessibilityInfo.announceForAccessibility(title);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 3200);
    },
    [opacity],
  );

  const color =
    toast?.tone === 'danger'
      ? theme.colors.danger
      : toast?.tone === 'info'
        ? theme.colors.info
        : theme.colors.safe;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + bottomOffset,
            alignItems: 'center',
            opacity,
          }}
        >
          <View
            key={toast.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              maxWidth: 560,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.overlay,
              borderWidth: 1,
              borderColor: theme.colors.borderSubtle,
              shadowColor: '#101828',
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            }}
          >
            <Icon
              name={toast.tone === 'danger' ? 'danger' : toast.tone === 'info' ? 'info' : 'safe'}
              size={20}
              weight="fill"
              color={color}
            />
            <Text weight="medium" style={{ flexShrink: 1 }}>
              {toast.title}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}
