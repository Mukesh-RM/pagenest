/**
 * Root Playwright entry point. The real configuration (projects, web server, targets) is owned by QA and lives in
 * tests/playwright.config.ts; this file only re-exports it so `npx playwright test` and `npm run test:e2e` work from
 * the repository root and from /tests with identical behaviour.
 */
export { default } from './tests/playwright.config';
