import { createDefaultRegistry } from './engines';
import type { ReaderRegistry } from './core/registry';

let shared: ReaderRegistry | undefined;

/** The app-wide engine registry, created on first use so engines load once and stay loaded. */
export function getReaderRegistry(): ReaderRegistry {
  shared ??= createDefaultRegistry();
  return shared;
}
