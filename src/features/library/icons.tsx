import { createElement } from 'react';

/**
 * The one outline icon the design system does not have yet: a heart, for "Add to favorites". The path
 * is from Lucide (ISC license), same 24 px grid and 2 px stroke as `src/ui/icons`. Request: add `heart`
 * to `src/ui/icons/nodes.ts` and delete this file.
 */
type Node = readonly [string, Record<string, string>];

const NODES = {
  heart: [['path', { d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' }]],
} satisfies Record<string, readonly Node[]>;

export type LibIconName = keyof typeof NODES;

export function LibIcon({ name, size = 24, filled = false }: { name: LibIconName; size?: number; filled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
      className="pn-icon"
    >
      {NODES[name].map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
    </svg>
  );
}
