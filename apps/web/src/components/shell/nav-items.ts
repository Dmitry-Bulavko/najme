import { Compass, CalendarCheck, type LucideIcon } from 'lucide-react';

export interface NavItem {
  /** Route segment below `/{locale}`. */
  href: string;
  /** Key inside the `nav` i18n namespace. */
  labelKey: 'discover' | 'bookings';
  icon: LucideIcon;
}

/** Primary navigation. Routes are placeholders until the M1 discovery/booking screens land. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: 'discover', labelKey: 'discover', icon: Compass },
  { href: 'bookings', labelKey: 'bookings', icon: CalendarCheck },
];
