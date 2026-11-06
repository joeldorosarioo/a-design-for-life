import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { configureTestEnvironment } from '../../testing/setup/test-environment';

// Opt in before validating the environment; ordinary suites keep first access closed.
process.env.ADFL_TEST_FIRST_ACCESS_ENABLED = 'true';
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.work/playwright-browsers');
const env = configureTestEnvironment();

export default defineConfig({
  testDir: '.',
  testMatch: 'browser-first-access.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  globalSetup: '../../testing/setup/playwright.ts',
  outputDir: '../../.work/browser-first-access-results',
  use: { baseURL: env.SITE_ORIGIN, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
