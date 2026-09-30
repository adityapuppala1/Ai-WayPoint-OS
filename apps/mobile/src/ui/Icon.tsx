/**
 * Pictograms by meaning ("shield", "phone"), the same set and names as the website. Icons
 * never carry meaning alone: they sit next to words, or carry an accessibility label.
 * Arrows and chevrons point the other way in right-to-left languages.
 */
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { ICON_PATHS, type IconName } from './icon-paths';

export type { IconName };

/** Icons that show a direction, mirrored in right-to-left layouts. */
const DIRECTIONAL = new Set<IconName>([
  'back',
  'forward',
  'chevronLeft',
  'chevronRight',
  'send',
  'signOut',
  'external',
]);

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  weight?: 'regular' | 'fill';
  /** Only for icons that stand alone; icons next to words are hidden from screen readers. */
  label?: string;
}

export function Icon({ name, size = 20, color, weight = 'regular', label }: IconProps) {
  const theme = useTheme();
  const mirrored = theme.isRTL && DIRECTIONAL.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path d={ICON_PATHS[name][weight]} fill={color ?? theme.colors.text} />
    </Svg>
  );
}
