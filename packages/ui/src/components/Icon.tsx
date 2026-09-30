import type { SVGProps } from 'react';
import { cn } from '../cn';
import { ICONS, type IconName, type IconWeight } from '../icons';

/** Icons that point along the reading direction and must flip in right-to-left languages. */
const DIRECTIONAL = new Set<IconName>([
  'back',
  'forward',
  'chevronLeft',
  'chevronRight',
  'send',
  'external',
  'reply',
]);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  name: IconName;
  size?: number | string;
  weight?: IconWeight;
  /** Accessible label. Omit for decorative icons (the default). */
  label?: string;
}

/** Semantic icon. Decorative by default (aria-hidden); pass `label` when it carries meaning alone. */
export function Icon({
  name,
  size = 20,
  weight = 'regular',
  label,
  className,
  ...rest
}: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      className={cn(DIRECTIONAL.has(name) && 'wp-icon-directional', className)}
      size={size}
      weight={weight}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
      {...rest}
    />
  );
}
