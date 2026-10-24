import { BookOpen, BarChart3, Library, Settings, type LucideIcon } from 'lucide-react';

export interface Tab {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** The four tabs from blueprint section 5.5, in order. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'Library', icon: BookOpen },
  { to: '/collections', label: 'Collections', icon: Library },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];
