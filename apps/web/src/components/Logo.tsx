/**
 * The Waypoint mark: a slate sign panel carrying a signal-yellow direction arrow.
 * Also drawn as the app icon (app/icon.svg) — keep the two in sync.
 */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="32" height="32" rx="7" fill="var(--wp-sign)" />
      <rect x="11" y="16" width="2.4" height="7.5" rx="1" fill="var(--wp-sign-muted)" />
      <path d="M8 8.5h12.2l4.3 4.5-4.3 4.5H8z" fill="var(--wp-signal)" />
    </svg>
  );
}

export function Wordmark({ label = 'Waypoint' }: { label?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--wp-space-2)',
        fontWeight: 600,
        fontSize: '1.1875rem',
        letterSpacing: '-0.01em',
      }}
    >
      <LogoMark size={28} />
      <span>{label}</span>
    </span>
  );
}
