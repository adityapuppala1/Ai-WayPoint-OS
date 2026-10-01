import styles from './landing.module.css';

/** Screens captured from the running app by scripts/brand/screenshots.mts. */
export type Shot = 'today' | 'shield' | 'ask' | 'help';

/** Pixel sizes of the captured files (CSS pixels × 2 for phones), for a page that does not jump. */
const PHONE = { width: 780, height: 1688 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;

const src = (shot: Shot, size: 'phone' | 'desktop', theme: 'light' | 'dark') =>
  `/landing/${shot}-${size}-${theme}.webp`;

/**
 * A real screen from Waypoint in a plain device frame: the light or dark capture to match the
 * page, and, where `wide` is set, the desktop capture in a screen frame on wide pages.
 * Not shown in lite mode (no images there), where the caption alone remains.
 */
export function DeviceShot({
  shot,
  alt,
  caption,
  wide = false,
}: {
  shot: Shot;
  alt: string;
  caption: string;
  wide?: boolean;
}) {
  const picture = (theme: 'light' | 'dark') => (
    <picture className={theme === 'light' ? styles.shotLight : styles.shotDark}>
      {wide ? (
        <source
          media="(min-width: 60rem)"
          srcSet={src(shot, 'desktop', theme)}
          width={DESKTOP.width}
          height={DESKTOP.height}
        />
      ) : null}
      <img
        src={src(shot, 'phone', theme)}
        alt={alt}
        width={PHONE.width}
        height={PHONE.height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
  return (
    <figure className={wide ? `${styles.device} ${styles.deviceWide}` : styles.device}>
      <div className={styles.frame}>
        {picture('light')}
        {picture('dark')}
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}
