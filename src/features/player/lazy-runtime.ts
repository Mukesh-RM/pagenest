import type { AudioController } from '@/engines/audio/types';

type ProviderModule = Awaited<ReturnType<typeof loadProviderModule>>;

async function loadProviderModule() {
  return import('./PlayerProvider');
}

let providerModule: ProviderModule | undefined;
let providerLoad: Promise<ProviderModule> | undefined;

/** Warm the player provider chunk (listen route intent, pointerdown on mini-player, idle). */
export function preloadPlayerEngine(): void {
  if (!providerLoad) {
    providerLoad = loadProviderModule().then((m) => {
      providerModule = m;
      return m;
    });
  }
}

export function getProviderModule(): ProviderModule | undefined {
  return providerModule;
}

export async function ensureProviderModule(): Promise<ProviderModule> {
  preloadPlayerEngine();
  return providerLoad!;
}

export async function getAudioControllerWhenReady(): Promise<AudioController | undefined> {
  const m = await ensureProviderModule();
  return m.getAudioController();
}

/** Wait until the singleton controller exists (provider must be mounted). */
export async function waitForAudioController(timeoutMs = 15_000): Promise<AudioController> {
  const start = Date.now();
  for (;;) {
    const m = await ensureProviderModule();
    const c = m.getAudioController();
    if (c) return c;
    if (Date.now() - start > timeoutMs) throw new Error('Audio controller did not start in time.');
    await new Promise((r) => setTimeout(r, 16));
  }
}
