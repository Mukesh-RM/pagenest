import type { Locator, ProgressService } from '@/app/contracts';
import type { MediaSessionBridge } from './media-session';
import { createMediaSessionBridge } from './media-session';
import type {
  AudioController,
  AudioItem,
  AudioOptions,
  AudioState,
  PlaybackStatus,
  SleepTimerSpec,
  SleepTimerState,
} from './types';
import {
  DEFAULT_AUDIO_OPTIONS,
  bookPositionFromLocator,
  clampSpeed,
  chapterIndexAt,
  locatorFromBookPosition,
  percentFromPosition,
  remainingAt,
  trackAtPosition,
} from './util';

const POSITION_EMIT_MS = 250;
const FADE_SEC = 3;

export interface HtmlAudioControllerDeps {
  readonly audio: HTMLAudioElement;
  readonly progress: ProgressService;
  readonly mediaSession?: MediaSessionBridge;
  readonly now?: () => number;
}

export function createAudioElement(doc: Document = document): HTMLAudioElement {
  const audio = doc.createElement('audio');
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  return audio;
}

/**
 * Single-element audiobook controller (blueprint sections 8 and 12.2).
 */
export function createAudioController(deps: HtmlAudioControllerDeps): AudioController {
  const audio = deps.audio;
  const progress = deps.progress;
  const now = deps.now ?? Date.now;
  const media =
    deps.mediaSession ??
    createMediaSessionBridge({
      play: () => controller.play(),
      pause: () => controller.pause(),
      skipBack: () => controller.skip(controller.getState().options.skipBackSec),
      skipForward: () => controller.skip(controller.getState().options.skipForwardSec),
      previousChapter: () => controller.previousChapter(),
      nextChapter: () => controller.nextChapter(),
      seekTo: (sec) => controller.seekTo(sec),
    });

  const listeners = new Set<(state: AudioState) => void>();
  let emitTimer: ReturnType<typeof setTimeout> | undefined;
  let lastEmit = 0;

  let status: PlaybackStatus = 'idle';
  let item: AudioItem | undefined;
  let positionSec = 0;
  let durationSec = 0;
  let chapterIndex = -1;
  let speed = 1;
  let options: AudioOptions = { ...DEFAULT_AUDIO_OPTIONS };
  let errorMessage: string | undefined;

  let currentTrackIndex = -1;
  let objectUrls: string[] = [];
  let preloadAudio: HTMLAudioElement | undefined;
  let coverUrl: string | undefined;

  let sleepSpec: SleepTimerSpec | null = null;
  let sleepEndsAtBookSec: number | undefined;
  let sleepFading = false;

  let pausedAtMs: number | undefined;
  let smartRewindPending = false;

  const controller: AudioController = {
    getState,
    subscribe(listener) {
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    },
    async load(nextItem, start) {
      await saveProgressNow();
      revokeUrls();
      item = nextItem;
      durationSec = sumDuration(nextItem);
      status = 'loading';
      errorMessage = undefined;
      positionSec = start ? bookPositionFromLocator(nextItem.tracks, start as Locator & { kind: 'audio' }) : 0;
      chapterIndex = chapterIndexAt(nextItem.chapters, positionSec);
      sleepSpec = null;
      sleepEndsAtBookSec = undefined;
      sleepFading = false;
      coverUrl = nextItem.cover ? URL.createObjectURL(nextItem.cover) : undefined;
      emit();
      await loadTrackAt(positionSec, false);
      status = 'ready';
      emit();
      media.sync(getState(), item, coverUrl);
    },
    async play() {
      if (!item) return;
      if (smartRewindPending && options.smartRewindSec > 0) {
        controller.skip(-options.smartRewindSec);
        smartRewindPending = false;
      }
      status = 'loading';
      emit();
      try {
        await audio.play();
        status = 'playing';
        pausedAtMs = undefined;
      } catch (err) {
        status = 'error';
        errorMessage = err instanceof Error ? err.message : 'Playback failed';
      }
      emit();
      media.sync(getState(), item, coverUrl);
    },
    pause() {
      if (status !== 'playing') return;
      audio.pause();
      status = 'paused';
      pausedAtMs = now();
      if (pausedAtMs && options.smartRewindSec > 0) smartRewindPending = true;
      void saveProgressNow();
      emit();
      media.sync(getState(), item, coverUrl);
    },
    async toggle() {
      if (status === 'playing') controller.pause();
      else await controller.play();
    },
    async stop() {
      controller.pause();
      await saveProgressNow();
      revokeUrls();
      item = undefined;
      status = 'idle';
      positionSec = 0;
      durationSec = 0;
      chapterIndex = -1;
      currentTrackIndex = -1;
      sleepSpec = null;
      media.clear();
      emit();
    },
    seekTo(bookPositionSec) {
      if (!item) return;
      const clamped = Math.max(0, Math.min(durationSec, bookPositionSec));
      positionSec = clamped;
      chapterIndex = chapterIndexAt(item.chapters, positionSec);
      void loadTrackAt(positionSec, status === 'playing');
      reportProgress();
      emit();
      media.sync(getState(), item, coverUrl);
    },
    skip(deltaSec) {
      controller.seekTo(positionSec + deltaSec);
    },
    goToChapter(index) {
      if (!item || index < 0 || index >= item.chapters.length) return;
      const chapter = item.chapters[index];
      if (!chapter) return;
      controller.seekTo(chapter.startSec);
    },
    nextChapter() {
      if (!item) return;
      const next = chapterIndex + 1;
      if (next < item.chapters.length) controller.goToChapter(next);
      else controller.seekTo(durationSec);
    },
    previousChapter() {
      if (!item) return;
      const prev = chapterIndex - 1;
      if (prev >= 0) controller.goToChapter(prev);
      else controller.seekTo(0);
    },
    setSpeed(rate) {
      speed = clampSpeed(rate);
      audio.playbackRate = speed;
      if ('preservesPitch' in audio) (audio as HTMLMediaElement & { preservesPitch: boolean }).preservesPitch = true;
      else if ('mozPreservesPitch' in audio) (audio as HTMLMediaElement & { mozPreservesPitch: boolean }).mozPreservesPitch = true;
      else if ('webkitPreservesPitch' in audio)
        (audio as HTMLMediaElement & { webkitPreservesPitch: boolean }).webkitPreservesPitch = true;
      emit();
      media.sync(getState(), item, coverUrl);
    },
    setOptions(partial) {
      options = { ...options, ...partial };
      emit();
    },
    setSleepTimer(timer) {
      sleepSpec = timer;
      sleepFading = false;
      if (!timer || !item) {
        sleepEndsAtBookSec = undefined;
        emit();
        return;
      }
      if (timer.kind === 'minutes') {
        sleepEndsAtBookSec = positionSec + timer.minutes * 60;
      } else {
        const next = item.chapters[chapterIndex + 1];
        sleepEndsAtBookSec = next ? next.startSec : durationSec;
      }
      emit();
    },
    extendSleepTimer(extraSec) {
      if (sleepEndsAtBookSec != null) sleepEndsAtBookSec += extraSec;
      emit();
    },
  };

  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('waiting', () => {
    if (status === 'playing') status = 'loading';
    emit();
  });
  audio.addEventListener('playing', () => {
    if (item) status = 'playing';
    emit();
  });
  audio.addEventListener('error', () => {
    status = 'error';
    errorMessage = audio.error?.message ?? 'Could not play this file';
    emit();
  });
  audio.addEventListener('stalled', () => {
    if (status === 'playing' && !audio.paused) void audio.play().catch(() => undefined);
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && status === 'paused') void progress.flush();
    });
  }

  function getState(): AudioState {
    const remain = remainingAt(positionSec, durationSec, item?.chapters ?? [], speed);
    const locator = item ? locatorFromBookPosition(item.tracks, positionSec) : undefined;
    let sleep: SleepTimerState | undefined;
    if (sleepSpec && sleepEndsAtBookSec != null) {
      const remainingSec = Math.max(0, (sleepEndsAtBookSec - positionSec) / speed);
      sleep = { spec: sleepSpec, remainingSec, fading: sleepFading };
    }
    return {
      status,
      item,
      positionSec,
      durationSec,
      chapterIndex,
      chapterRemainingSec: remain.chapterRemainingSec,
      bookRemainingSec: remain.bookRemainingSec,
      locator,
      speed,
      options,
      sleep,
      errorMessage,
    };
  }

  function emit(force = false) {
    const t = now();
    if (!force && t - lastEmit < POSITION_EMIT_MS) {
      if (!emitTimer) {
        emitTimer = setTimeout(() => {
          emitTimer = undefined;
          lastEmit = now();
          const snapshot = getState();
          for (const l of listeners) l(snapshot);
          media.sync(snapshot, item, coverUrl);
        }, POSITION_EMIT_MS);
      }
      return;
    }
    lastEmit = t;
    const snapshot = getState();
    for (const l of listeners) l(snapshot);
    media.sync(snapshot, item, coverUrl);
  }

  function onTimeUpdate() {
    if (!item || currentTrackIndex < 0) return;
    const track = item.tracks[currentTrackIndex];
    if (!track) return;
    positionSec = track.startOffsetSec + audio.currentTime;
    chapterIndex = chapterIndexAt(item.chapters, positionSec);
    reportProgress();
    tickSleep();
    emit();
  }

  function tickSleep() {
    if (sleepEndsAtBookSec == null || !sleepSpec) return;
    const remaining = sleepEndsAtBookSec - positionSec;
    if (remaining <= 0) {
      controller.pause();
      sleepSpec = null;
      sleepEndsAtBookSec = undefined;
      sleepFading = false;
      return;
    }
    if (remaining <= FADE_SEC && !sleepFading) {
      sleepFading = true;
      const startVol = audio.volume;
      const step = startVol / (FADE_SEC * 10);
      const fade = () => {
        if (!sleepFading) return;
        audio.volume = Math.max(0, audio.volume - step);
        if (audio.volume > 0) setTimeout(fade, 100);
        else controller.pause();
      };
      fade();
    }
  }

  async function onEnded() {
    if (!item) return;
    const nextTrack = item.tracks.find((t) => t.index === currentTrackIndex + 1);
    if (nextTrack) {
      await loadTrack(nextTrack, 0, status === 'playing');
      void progress.flush(item.bookId);
      return;
    }
    status = 'ended';
    await saveProgressNow();
    emit(true);
  }

  function reportProgress() {
    if (!item) return;
    const locator = locatorFromBookPosition(item.tracks, positionSec);
    progress.report(item.bookId, 'listen', locator, percentFromPosition(positionSec, durationSec));
  }

  async function saveProgressNow() {
    if (!item) return;
    const locator = locatorFromBookPosition(item.tracks, positionSec);
    await progress.save(item.bookId, 'listen', locator, percentFromPosition(positionSec, durationSec));
  }

  async function loadTrackAt(bookPos: number, autoplay: boolean) {
    if (!item) return;
    const at = trackAtPosition(item.tracks, bookPos);
    if (!at) return;
    await loadTrack(at.track, at.offsetInTrackSec, autoplay);
    preloadNext(at.track.index);
  }

  async function loadTrack(track: AudioItem['tracks'][number], offsetSec: number, autoplay: boolean) {
    currentTrackIndex = track.index;
    status = 'loading';
    emit();
    const blob = await track.open();
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    audio.src = url;
    audio.playbackRate = speed;
    if ('preservesPitch' in audio) (audio as HTMLMediaElement & { preservesPitch: boolean }).preservesPitch = true;
    await new Promise<void>((resolve, reject) => {
      const onMeta = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onErr);
        audio.currentTime = offsetSec;
        resolve();
      };
      const onErr = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onErr);
        reject(new Error(audio.error?.message ?? 'Load failed'));
      };
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('error', onErr);
      audio.load();
    });
    positionSec = track.startOffsetSec + offsetSec;
    chapterIndex = chapterIndexAt(item!.chapters, positionSec);
    if (autoplay) await controller.play();
    else {
      status = 'ready';
      emit(true);
    }
  }

  function preloadNext(trackIndex: number) {
    if (!item) return;
    const next = item.tracks.find((t) => t.index === trackIndex + 1);
    if (!next) return;
    void next.open().then((blob) => {
      preloadAudio?.remove();
      preloadAudio = document.createElement('audio');
      preloadAudio.preload = 'auto';
      preloadAudio.src = URL.createObjectURL(blob);
    });
  }

  function revokeUrls() {
    for (const u of objectUrls) URL.revokeObjectURL(u);
    objectUrls = [];
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    coverUrl = undefined;
    preloadAudio?.remove();
    preloadAudio = undefined;
  }

  return controller;
}

function sumDuration(item: AudioItem): number {
  if (item.tracks.length === 0) return 0;
  const last = item.tracks.at(-1);
  if (!last) return 0;
  return last.startOffsetSec + last.durationSec;
}
