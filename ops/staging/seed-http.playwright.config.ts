import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

// A fresh owned run is part of this proof: the seed must reject libraries left
// by other suites rather than adopt them as its own staging demonstration.
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'seed-http.e2e.ts',
  globalSetup: '../../testing/setup/playwright.ts',
});
