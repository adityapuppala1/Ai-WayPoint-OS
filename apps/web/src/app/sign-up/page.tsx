import { safeNextPath } from '@waypoint/core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthForm } from '@/components/auth/AuthForm';
import { PublicShell } from '@/components/shell/PublicShell';
import { getViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signUpTitle') };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, viewer] = await Promise.all([searchParams, getViewer()]);
  return (
    <PublicShell hideSignIn>
      <AuthForm
        mode="sign-up"
        next={safeNextPath(next)}
        visitor={viewer?.user.isGuest ? 'guest' : 'visitor'}
      />
    </PublicShell>
  );
}
