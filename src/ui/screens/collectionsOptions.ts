import type { IconName } from '../icons';

/** One shelf the person made. */
export interface CollectionShelf {
  id: string;
  name: string;
  bookCount: number;
  /** Up to four cover image URLs for the little collage. Without any, a shelf icon is drawn. */
  covers?: readonly string[];
}

/** An automatic shelf the app fills by itself ("Unfinished"). */
export interface SmartCollection {
  id: string;
  name: string;
  /** One plain sentence. */
  description: string;
  icon?: IconName;
}

export const DEFAULT_SMART_COLLECTIONS: readonly SmartCollection[] = [
  { id: 'unfinished', name: 'Unfinished', description: 'Books you started and have not finished', icon: 'bookOpen' },
  { id: 'recent', name: 'Recently added', description: 'The newest books first', icon: 'sparkles' },
];

export const MAX_SHELF_NAME_LENGTH = 60;
