/**
 * The Waypoint mark: the "i" of information carrying a direction sign, signal yellow on a
 * slate tile. The same drawing as the website's logo and the app icons (the numbers come from
 * apps/web/src/components/brand/geometry.ts, from which `pnpm brand` makes assets/); keep
 * them in step. The sign points the way the language reads.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

export function LogoMark({ size = 40, label }: { size?: number; label?: string }) {
  const theme = useTheme();
  const signal = theme.colors.signal;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      style={theme.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Rect width={64} height={64} rx={15} fill={theme.colors.sign} />
      <Circle cx={19} cy={13} r={5.5} fill={signal} />
      <Path d="M19 24V51.5" stroke={signal} strokeWidth={7.5} strokeLinecap="round" />
      <Path
        d="M19 24H38.5L47 32.5 38.5 41H19Z"
        fill={signal}
        stroke={signal}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
