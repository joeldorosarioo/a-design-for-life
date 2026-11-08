import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const aliases = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@payload-config': fileURLToPath(new URL('./src/payload.config.ts', import.meta.url)),
  // The build enforces server-only. Node tests have no browser boundary.
  'server-only': fileURLToPath(new URL('./testing/setup/server-only.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: aliases },
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [
            'src/**/*.integration.test.*',
            'src/**/*.e2e.test.*',
            'src/config/architecture.test.ts',
          ],
          setupFiles: ['./testing/setup/vitest.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: 'integration',
          globalSetup: ['./testing/setup/integration-global.ts'],
          include: ['src/**/*.integration.test.ts'],
          setupFiles: ['./testing/setup/integration.ts'],
          environment: 'node',
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: 'architecture',
          include: ['src/config/architecture.test.ts'],
          environment: 'node',
          // Each graph analysis starts the real CLI and includes its startup cost.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
