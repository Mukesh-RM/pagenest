import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';

// Lazy screens are transformed by Vitest the first time a test opens them, which can take seconds on a busy machine
// (several bots share one). Passing tests are not slower; only a failing wait takes longer to give up.
configure({ asyncUtilTimeout: 5000 });
