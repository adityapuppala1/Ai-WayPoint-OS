import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/PasswordReset';
import { PublicShell } from '@/components/shell/PublicShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('resetTitle'), robots: { index: false }, referrer: 'no-referrer' };
}

/**
 * Where the link in a password-reset email lands (Better Auth checks the token first and adds
 * it, or `?error=INVALID_TOKEN`, to this address).
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const valid = !error && typeof token === 'string' && /^[\w-]{8,256}$/.test(token);
  return (
    <PublicShell hideSignIn>
      <ResetPasswordForm token={valid ? (token as string) : null} />
    </PublicShell>
  );
}
