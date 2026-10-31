export { createAudioController, createAudioElement, type HtmlAudioControllerDeps } from './audio-controller';
export { audioItemFromFolder, audioItemFromSingleFile, type FolderTrackInput } from './build-item';
export { parseCueSheet } from './chapters/cue';
export { evenChapters } from './chapters/even';
export { chaptersFromId3 } from './chapters/id3';
export { chaptersFromMp4Box } from './chapters/m4b';
export { parseAudioMetadata, disposeMetadataWorker } from './metadata-client';
export { createMediaSessionBridge, chapterSubtitle, type MediaSessionActions, type MediaSessionBridge } from './media-session';
export type * from './types';
export {
  DEFAULT_AUDIO_OPTIONS,
  MIN_SPEED,
  MAX_SPEED,
  clampSpeed,
  chapterIndexAt,
  formatClock,
  naturalCompare,
  percentFromPosition,
  locatorFromBookPosition,
  bookPositionFromLocator,
} from './util';
