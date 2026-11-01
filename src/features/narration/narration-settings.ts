import { getSetting, setSetting, SETTING_KEYS } from '@/data/settings';
import type { PageNestDB } from '@/data/db';
import { isSpeechVoiceId, pickDefaultSpeechVoice } from '@/engines/tts/speech-engine';
import { piperVoiceById } from '@/engines/tts/piper/voices';
import type { VoiceInfo } from '@/engines/tts/types';
import { DEFAULT_NARRATION_SETTINGS, type NarrationSettings } from './types';

/** Set when the user explicitly picks an HD (Piper) voice in the picker — skips auto-migration. */
export type StoredNarrationSettings = NarrationSettings & { readonly hdVoiceExplicit?: boolean };

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const STYLES = ['natural', 'expressive', 'cast'] as const;

export function parseNarrationSettings(value: unknown, fallback: NarrationSettings = DEFAULT_NARRATION_SETTINGS): StoredNarrationSettings {
  if (typeof value !== 'object' || value === null) return { ...fallback };
  const v = value as Record<string, unknown>;
  const speed = typeof v.speed === 'number' && SPEEDS.includes(v.speed as (typeof SPEEDS)[number]) ? v.speed : fallback.speed;
  const style = STYLES.find((s) => s === v.style) ?? fallback.style;
  const engine = v.engine === 'piper' || v.engine === 'speech' || v.engine === 'helper' || v.engine === 'kokoro' ? v.engine : fallback.engine;
  return {
    engine,
    voiceId: typeof v.voiceId === 'string' ? v.voiceId : fallback.voiceId,
    speed,
    style,
    expressive: v.expressive === true,
    hdVoiceExplicit: v.hdVoiceExplicit === true,
  };
}

/**
 * Move legacy Piper defaults to device Web Speech unless the user explicitly chose HD.
 * Keeps own-voice and installed speech selections.
 */
export function migrateNarrationSettings(
  saved: StoredNarrationSettings,
  voices: readonly VoiceInfo[],
): StoredNarrationSettings {
  const device = pickDefaultSpeechVoice(voices);
  if (!device) return { ...saved, engine: 'speech' };

  const match = voices.find((v) => v.id === saved.voiceId);
  if (saved.hdVoiceExplicit && match && (match.engine === 'piper' || match.isOwnVoice)) {
    return saved;
  }
  if (match?.isOwnVoice) return saved;
  if (saved.engine === 'speech' && match?.engine === 'speech' && isSpeechVoiceId(saved.voiceId)) {
    return saved;
  }

  const legacyPiper =
    saved.engine === 'piper' ||
    Boolean(piperVoiceById(saved.voiceId)) ||
    (match?.engine === 'piper' && !saved.hdVoiceExplicit);

  if (legacyPiper || !saved.voiceId || !match) {
    return {
      ...saved,
      engine: 'speech',
      voiceId: device.id,
      hdVoiceExplicit: false,
    };
  }

  return saved;
}

export async function loadNarrationSettings(db: PageNestDB, voices: readonly VoiceInfo[]): Promise<StoredNarrationSettings> {
  const raw = await getSetting<unknown>(db, SETTING_KEYS.narrationSettings).catch(() => undefined);
  const parsed = parseNarrationSettings(raw);
  return migrateNarrationSettings(parsed, voices);
}

export async function saveNarrationSettings(db: PageNestDB, settings: StoredNarrationSettings): Promise<void> {
  try {
    await setSetting(db, SETTING_KEYS.narrationSettings, settings);
  } catch {
    /* private mode */
  }
}
