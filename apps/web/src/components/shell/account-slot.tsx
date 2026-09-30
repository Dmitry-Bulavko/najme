'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth/session-context';

/** Returns up to two uppercase initials from a display name or email address. */
function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  // Fall back to first two characters of the local part of the email.
  const local = email.split('@')[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

/**
 * Account area of the site header. Renders a "Sign in" link when the user is anonymous,
 * a loading placeholder while the session is being restored, and an avatar dropdown for
 * authenticated users. Uses the client-side AuthProvider — must be a Client Component.
 */
export function AccountSlot() {
  const t = useTranslations('auth');
  const session = useSession();
  const router = useRouter();

  if (session.state === 'loading') {
    return <div className="size-8 animate-pulse rounded-full bg-muted" aria-hidden="true" />;
  }

  if (session.state === 'anonymous') {
    return (
      <Link
        href="/sign-in"
        className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
      >
        {t('header.signIn')}
      </Link>
    );
  }

  const { me, signOut } = session;
  const initials = getInitials(me.displayName ?? null, me.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t('header.menuLabel')}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{me.displayName ?? me.email}</p>
          {me.displayName ? (
            <p className="truncate text-xs text-muted-foreground">{me.email}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">{t('header.profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.replace('/');
          }}
        >
          {t('header.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
