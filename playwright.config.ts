import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { configureTestEnvironment } from './testing/setup/test-environment';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.work/playwright-browsers');
const env = configureTestEnvironment();

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './testing/setup/playwright.ts',
  use: { baseURL: env.SITE_ORIGIN, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
