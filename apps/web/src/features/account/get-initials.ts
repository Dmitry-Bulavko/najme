/**
 * Returns up to two uppercase initials from a display name or email address.
 */
export function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return (parts[0]?.[0] ?? '').toUpperCase();
    }
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  const local = email.split('@')[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}
