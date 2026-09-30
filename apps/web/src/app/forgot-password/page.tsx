import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/auth/PasswordReset';
import { PublicShell } from '@/components/shell/PublicShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('forgotTitle'), robots: { index: false } };
}

export default function ForgotPasswordPage() {
  return (
    <PublicShell hideSignIn>
      <ForgotPasswordForm />
    </PublicShell>
  );
}
