import { me } from '@waypoint/api';
import { safeNextPath } from '@waypoint/core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthForm, type AuthVisitor } from '@/components/auth/AuthForm';
import { PublicShell } from '@/components/shell/PublicShell';
import { getViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signInTitle') };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, viewer] = await Promise.all([searchParams, getViewer()]);
  // A guest on this device: say what happens to what they did when they sign in.
  let visitor: AuthVisitor = 'visitor';
  if (viewer?.user.isGuest)
    visitor = (await me.guestAccountPending(viewer.db, viewer.user.id))
      ? 'guest-with-account'
      : 'guest';
  return (
    <PublicShell hideSignIn>
      <AuthForm mode="sign-in" next={safeNextPath(next)} visitor={visitor} />
    </PublicShell>
  );
}
