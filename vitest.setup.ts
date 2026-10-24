import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import { createMockAudioElement } from '@/engines/audio/test/mock-audio';

vi.mock('@/engines/audio', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createAudioElement: () => createMockAudioElement(),
  };
});

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:vitest';
  URL.revokeObjectURL = () => undefined;
}

configure({ asyncUtilTimeout: 5000 });
