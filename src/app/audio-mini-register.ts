import type { ComponentType } from 'react';

let ready: ComponentType | null = null;
const listeners = new Set<() => void>();

export function registerMiniPlayerComponent(component: ComponentType): void {
  ready = component;
  listeners.forEach((l) => l());
}

export function subscribeMiniPlayerReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMiniPlayerComponent(): ComponentType | null {
  return ready;
}
