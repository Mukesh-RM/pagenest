import { useId } from 'react';
import { Chip, ChipGroup, Icon } from '@/ui';
import { FILTERS, SORT_KEYS, SORT_LABELS, type FilterId, type SortKey, type ViewMode } from '../model';

export interface ToolbarProps {
  text: string;
  onText: (text: string) => void;
  filter: FilterId;
  onFilter: (filter: FilterId) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  /** Hide the sort select (a search ranks by relevance, a shelf keeps its own order). */
  showSort?: boolean;
}

/**
 * Search, the filter chips, the labelled sort select and the grid or list switch. This is the design
 * system's Library toolbar (`LibraryScreen`), with the same classes and words, so it looks the same:
 * a pill search field, a chip row that scrolls with a fade at its end, then "Sort by" and the switch.
 */
export function Toolbar({ text, onText, filter, onFilter, sort, onSort, view, onView, showSort = true }: ToolbarProps) {
  const searchId = useId();
  const sortId = useId();
  return (
    <div className="pn-library__tools">
      <div className="pn-search" role="search">
        <label htmlFor={searchId} className="pn-visually-hidden">
          Search your library
        </label>
        <span className="pn-search__icon" aria-hidden="true">
          <Icon name="search" size={20} />
        </span>
        <input
          id={searchId}
          type="search"
          className="pn-search__input"
          placeholder="Search books"
          value={text}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => onText(event.target.value)}
        />
      </div>
      <div className="pn-library__filters">
        <ChipGroup label="Filter library" scroll>
          {FILTERS.map((f) => (
            <Chip key={f.id} selected={filter === f.id} onClick={() => onFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </ChipGroup>
      </div>
      <div className="pn-library__options">
        {showSort ? (
          <div className="pn-sort">
            <label htmlFor={sortId} className="pn-sort__label">
              Sort by
            </label>
            <span className="pn-sort__field">
              <select id={sortId} className="pn-sort__select" value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              <span className="pn-sort__chevron" aria-hidden="true">
                <Icon name="chevronDown" size={18} />
              </span>
            </span>
          </div>
        ) : (
          <span />
        )}
        <div role="group" aria-label="Library layout" className="pn-viewswitch">
          <button type="button" className="pn-viewswitch__btn" aria-pressed={view === 'grid'} aria-label="Grid of covers" onClick={() => onView('grid')}>
            <Icon name="layoutGrid" size={20} />
          </button>
          <button type="button" className="pn-viewswitch__btn" aria-pressed={view === 'list'} aria-label="List" onClick={() => onView('list')}>
            <Icon name="list" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
