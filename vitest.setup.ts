import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import { createMockAudioElement } from '@/engines/audio/test/mock-audio';

vi.mock('@/engines/audio', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createAudioElement: vi.fn(() => createMockAudioElement()),
  };
});

// Lazy screens are transformed by Vitest the first time a test opens them, which can take seconds on a busy machine
// (several bots share one). Passing tests are not slower; only a failing wait takes longer to give up.
configure({ asyncUtilTimeout: 5000 });

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:vitest';
  URL.revokeObjectURL = () => undefined;
}

if (typeof Object.groupBy !== 'function') {
  Object.groupBy = <T>(items: Iterable<T>, callback: (item: T, index: number) => PropertyKey) => {
    const out = Object.create(null) as Record<PropertyKey, T[]>;
    let i = 0;
    for (const item of items) {
      const key = callback(item, i++);
      (out[key] ??= []).push(item);
    }
    return out;
  };
}
