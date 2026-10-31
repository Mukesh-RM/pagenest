import { preloadPlayerEngine, waitForAudioController } from './lazy-runtime';

export async function togglePlayback(): Promise<void> {
  preloadPlayerEngine();
  const controller = await waitForAudioController();
  await controller.toggle();
}

export async function skipBack(seconds: number): Promise<void> {
  preloadPlayerEngine();
  const controller = await waitForAudioController();
  controller.skip(-seconds);
}
