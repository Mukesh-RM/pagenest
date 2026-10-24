/**
 * Shared test setup for the design system. Import it first in every jsdom test file:
 *   import '../test/setup';
 * It registers the jest-dom matchers and unmounts React trees after each test, so the tests
 * work whether or not the host project enables Vitest globals.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-mode');
  document.documentElement.removeAttribute('data-reduce-motion');
});
