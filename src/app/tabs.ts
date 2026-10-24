import { DEFAULT_NAV_ITEMS, type NavItem } from '@/ui';

/** The four tabs from blueprint 5.5 (design system items) with the route each one opens. */
export const NAV_ITEMS: readonly NavItem[] = DEFAULT_NAV_ITEMS.map((item) => ({
  ...item,
  href: item.id === 'library' ? '/' : `/${item.id}`,
}));

/** Id of the tab that owns `pathname`; unknown paths count as the Library. */
export function tabForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => item.href !== '/' && item.href !== undefined && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return match?.id ?? 'library';
}
