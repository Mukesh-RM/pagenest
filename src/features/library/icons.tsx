import { createElement } from 'react';

/**
 * A few outline icons the design system does not have yet (grid, list, heart, trash, pencil, upload,
 * sort, folder-plus, check-circle). Paths are from Lucide (ISC license), same 24 px grid and 2 px
 * stroke as `src/ui/icons`. Request: add these to `src/ui/icons/nodes.ts` and delete this file.
 */
type Node = readonly [string, Record<string, string>];

const NODES = {
  grid: [
    ['rect', { width: '7', height: '7', x: '3', y: '3', rx: '1' }],
    ['rect', { width: '7', height: '7', x: '14', y: '3', rx: '1' }],
    ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '1' }],
    ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '1' }],
  ],
  list: [
    ['path', { d: 'M3 12h.01' }],
    ['path', { d: 'M3 18h.01' }],
    ['path', { d: 'M3 6h.01' }],
    ['path', { d: 'M8 12h13' }],
    ['path', { d: 'M8 18h13' }],
    ['path', { d: 'M8 6h13' }],
  ],
  heart: [['path', { d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' }]],
  trash: [
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }],
    ['path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }],
    ['line', { x1: '10', x2: '10', y1: '11', y2: '17' }],
    ['line', { x1: '14', x2: '14', y1: '11', y2: '17' }],
  ],
  pencil: [['path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' }]],
  upload: [
    ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
    ['polyline', { points: '17 8 12 3 7 8' }],
    ['line', { x1: '12', x2: '12', y1: '3', y2: '15' }],
  ],
  checkCircle: [
    ['path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }],
    ['polyline', { points: '22 4 12 14.01 9 11.01' }],
  ],
  sort: [
    ['path', { d: 'm21 16-4 4-4-4' }],
    ['path', { d: 'M17 20V4' }],
    ['path', { d: 'm3 8 4-4 4 4' }],
    ['path', { d: 'M7 4v16' }],
  ],
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
