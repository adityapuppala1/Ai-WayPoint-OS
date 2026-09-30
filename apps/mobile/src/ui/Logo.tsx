/**
 * The Waypoint mark: a slate sign panel carrying a signal-yellow direction arrow. The same
 * drawing as the website's logo and the app icon (see assets/); keep them in step. The arrow
 * points the way the language reads.
 */
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

export function LogoMark({ size = 40, label }: { size?: number; label?: string }) {
  const theme = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      style={theme.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Rect width={32} height={32} rx={7} fill={theme.colors.sign} />
      <Rect x={11} y={16} width={2.4} height={7.5} rx={1} fill={theme.colors.signMuted} />
      <Path d="M8 8.5h12.2l4.3 4.5-4.3 4.5H8z" fill={theme.colors.signal} />
    </Svg>
  );
}
