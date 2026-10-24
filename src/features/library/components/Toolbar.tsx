import { useId } from 'react';
import { Button, Chip, ChipGroup, Icon } from '@/ui';
import { LibIcon } from '../icons';
import {
  CHIP_LABELS,
  SEGMENT_LABELS,
  SORT_KEYS,
  SORT_LABELS,
  type FilterChip,
  type Segment,
  type SortKey,
  type ViewMode,
} from '../model';

export interface ToolbarProps {
  text: string;
  onText: (text: string) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  segment: Segment;
  onSegment: (segment: Segment) => void;
  chip: FilterChip | null;
  onChip: (chip: FilterChip | null) => void;
  selectMode: boolean;
  onSelectMode: () => void;
  /** Hide the sort control (a shelf keeps its own order). */
  showSort?: boolean;
}

const SEGMENTS = Object.keys(SEGMENT_LABELS) as Segment[];
const CHIPS = Object.keys(CHIP_LABELS) as FilterChip[];

/**
 * Search, sort, view, select, and the filter chips. Sticky under the title; every control is 44 px
 * and the bar never changes height, so nothing moves when results change.
 */
export function Toolbar({ text, onText, view, onView, sort, onSort, segment, onSegment, chip, onChip, selectMode, onSelectMode, showSort = true }: ToolbarProps) {
  const searchId = useId();
  return (
    <div className="pn-lib-bar">
      <div className="pn-lib-bar__row">
        <div className="pn-lib-search" role="search">
          <label htmlFor={searchId} className="pn-visually-hidden">
            Search your library
          </label>
          <Icon name="search" size={20} />
          <input
            id={searchId}
            type="search"
            className="pn-lib-search__input"
            placeholder="Search title, author or narrator"
            value={text}
            onChange={(e) => onText(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </div>
        {showSort ? (
          <label className="pn-lib-sort">
            <LibIcon name="sort" size={20} />
            <span className="pn-lib-sort__text">{SORT_LABELS[sort]}</span>
            <select aria-label="Sort books" className="pn-lib-sort__select" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="pn-btn pn-btn--ghost pn-btn--icon"
          aria-label={view === 'grid' ? 'Show as a list' : 'Show as a grid'}
          onClick={() => onView(view === 'grid' ? 'list' : 'grid')}
        >
          <LibIcon name={view === 'grid' ? 'list' : 'grid'} />
        </button>
        <Button variant={selectMode ? 'secondary' : 'ghost'} iconOnly icon="check" aria-label={selectMode ? 'Stop selecting' : 'Select books'} aria-pressed={selectMode} onClick={onSelectMode} />
      </div>
      <div className="pn-lib-chips">
        <ChipGroup label="Show">
          {SEGMENTS.map((s) => (
            <Chip key={s} selected={segment === s} onClick={() => onSegment(s)}>
              {SEGMENT_LABELS[s]}
            </Chip>
          ))}
        </ChipGroup>
        <span className="pn-lib-chips__rule" aria-hidden="true" />
        <ChipGroup label="Filter">
          {CHIPS.map((c) => (
            <Chip key={c} selected={chip === c} onClick={() => onChip(chip === c ? null : c)}>
              {CHIP_LABELS[c]}
            </Chip>
          ))}
        </ChipGroup>
      </div>
    </div>
  );
}
