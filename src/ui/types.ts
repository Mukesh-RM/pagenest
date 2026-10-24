import type { ThemeName } from './theme/themes';

/** What the library grid needs to draw one book. The data layer maps its records to this. */
export interface BookSummary {
  id: string;
  title: string;
  /** One or more authors, any length; the card shows up to two lines. */
  author?: string;
  /** Object URL, data URL or path. Without one, a title card is generated. */
  coverUrl?: string;
  /** 0 to 1. */
  progress: number;
  /** The book has audio (audiobook, or read-aloud ready): shows the headphone badge. */
  audio?: boolean;
  /** A favorite: a small heart on the cover, "Favorite" in the card's spoken name. */
  favorite?: boolean;
}

export interface BookDetail extends BookSummary {
  narrator?: string;
  /** "EPUB", "PDF", "M4B"... */
  format?: string;
  pages?: number;
  /**
   * Force the "audio only" layout: Listen is the main action and Read is hidden. Leave out and it is worked out by
   * `isAudioOnly`: audio, no page count, and not a text format.
   */
  audioOnly?: boolean;
  durationSeconds?: number;
  description?: string;
  /** Plain-words place in the book for the resume line, e.g. "chapter 7". */
  where?: string;
}

export interface ReaderFontOption {
  id: string;
  label: string;
  /** CSS font-family value. */
  family: string;
}

export type LineSpacing = 'compact' | 'comfortable' | 'airy';
export type MarginSize = 'narrow' | 'medium' | 'wide';

export interface ReaderSettings {
  /** Text size in px at 100%. */
  fontSize: number;
  fontId: string;
  /** The reader theme; independent of the app theme. */
  theme: ThemeName;
  lineSpacing: LineSpacing;
  margins: MarginSize;
}

export interface VoiceOption {
  id: string;
  name: string;
  /** "English (UK)". */
  language: string;
  /** "Natural", "Compact"... */
  quality: string;
  /** Download size text, already formatted, e.g. "38 MB". */
  size?: string;
  /** Voice is on the device and ready to use offline. */
  installed?: boolean;
}

/** Persistence for one-time hints. The app passes localStorage, IndexedDB, or settings behind this. */
export interface HintStore {
  hasSeen: (id: string) => boolean;
  markSeen: (id: string) => void;
}
